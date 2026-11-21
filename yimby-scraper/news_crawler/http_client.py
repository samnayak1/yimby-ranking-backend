from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from typing import Awaitable, Callable
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

log = logging.getLogger(__name__)

ROBOTS_AGENT = "YimbyNewsCrawler"


class Disallowed(Exception):
    """The site's robots.txt doesn't allow this URL."""


class PoliteHttpClient:
    """An async httpx client with the manners a crawler owes the sites it reads:
    robots.txt is obeyed, and each site gets one request at a time with a pause
    between them, however many seeds are being crawled at once. Callers can
    send conditional-GET validators so unchanged pages cost a 304."""

    def __init__(
        self,
        user_agent: str,
        delay_seconds: float = 2.0,
        timeout_seconds: float = 20.0,
        transport: httpx.AsyncBaseTransport | None = None,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._client = httpx.AsyncClient(
            headers={"User-Agent": user_agent},
            timeout=timeout_seconds,
            follow_redirects=True,
            transport=transport,
        )
        self._delay = delay_seconds
        self._clock = clock
        self._sleep = sleep
        self._last_request: dict[str, float] = {}
        # One lock per site: requests to the same host queue up behind it,
        # requests to different hosts run side by side.
        self._host_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._robots: dict[str, RobotFileParser] = {}
        self._robots_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def get(self, url: str, etag: str | None = None, last_modified: str | None = None) -> httpx.Response:
        if not await self.allowed(url):
            raise Disallowed(url)

        headers = {}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        return await self._request(url, headers)

    async def allowed(self, url: str) -> bool:
        return (await self._robots_for(url)).can_fetch(ROBOTS_AGENT, url)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> PoliteHttpClient:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.aclose()

    async def _request(self, url: str, headers: dict[str, str] | None = None) -> httpx.Response:
        host = urlsplit(url).netloc
        async with self._host_locks[host]:
            last = self._last_request.get(host)
            if last is not None:
                wait = self._delay - (self._clock() - last)
                if wait > 0:
                    await self._sleep(wait)
            try:
                return await self._client.get(url, headers=headers)
            finally:
                self._last_request[host] = self._clock()

    async def _robots_for(self, url: str) -> RobotFileParser:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        # Locked so two tasks starting on the same site fetch robots.txt once.
        async with self._robots_locks[origin]:
            if origin not in self._robots:
                self._robots[origin] = await self._load_robots(origin)
        return self._robots[origin]

    async def _load_robots(self, origin: str) -> RobotFileParser:
        # Follows RFC 9309: no robots.txt (4xx) means everything is allowed; one
        # that can't be read (5xx, network error) means nothing is.
        parser = RobotFileParser()
        try:
            resp = await self._request(f"{origin}/robots.txt")
        except httpx.HTTPError as err:
            log.warning("robots.txt unreachable for %s (%s); skipping the site", origin, err)
            parser.disallow_all = True
            return parser

        if resp.status_code >= 500:
            log.warning("robots.txt returned %s for %s; skipping the site", resp.status_code, origin)
            parser.disallow_all = True
        elif resp.status_code >= 400:
            parser.allow_all = True
        else:
            parser.parse(resp.text.splitlines())
        return parser
