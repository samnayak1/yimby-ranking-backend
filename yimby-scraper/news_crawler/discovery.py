from __future__ import annotations

import calendar
import html
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from urllib.parse import unquote, urljoin, urlsplit

import feedparser
import lxml.html
from defusedxml import ElementTree

from .http_client import PoliteHttpClient
from .models import Candidate, Discovery, Seed, SeedType, SourceState
from .urls import is_http_url, normalize_url

log = logging.getLogger(__name__)

_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")
_SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def parse_date(value: str | None) -> datetime | None:
    """ISO 8601 date or timestamp → UTC-aware datetime; None if unparseable."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.strip())
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def plain_text(fragment: str, limit: int = 500) -> str:
    text = _SPACE.sub(" ", html.unescape(_TAG.sub(" ", fragment or ""))).strip()
    return text[:limit]


def title_from_slug(url: str) -> str:
    """Sitemaps carry no titles, but most article URLs end in one:
    /post/cherry-creek-west-breaks-ground → "cherry creek west breaks ground"."""
    slug = unquote(urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1])
    return _SPACE.sub(" ", re.sub(r"[-_]+", " ", slug)).strip()


class Discoverer(ABC):
    """Turns one seed into candidate article links."""

    def __init__(self, http: PoliteHttpClient) -> None:
        self._http = http

    @abstractmethod
    async def discover(self, seed: Seed, state: SourceState) -> Discovery: ...

    async def _fetch(self, seed: Seed, state: SourceState) -> tuple[Discovery, bytes | None]:
        """Conditional GET of the seed URL. Returns the body, or None on a 304."""
        resp = await self._http.get(seed.url, etag=state.etag, last_modified=state.last_modified)
        if resp.status_code == 304:
            return Discovery(not_modified=True, etag=state.etag, last_modified=state.last_modified), None
        resp.raise_for_status()
        return Discovery(etag=resp.headers.get("ETag"), last_modified=resp.headers.get("Last-Modified")), resp.content


class FeedDiscoverer(Discoverer):
    async def discover(self, seed: Seed, state: SourceState) -> Discovery:
        discovery, body = await self._fetch(seed, state)
        if body is None:
            return discovery

        feed = feedparser.parse(body)
        for entry in feed.entries:
            link = entry.get("link", "")
            if not is_http_url(link):
                continue
            discovery.candidates.append(Candidate(
                url=normalize_url(link),
                source=seed.name,
                title=plain_text(entry.get("title", ""), 300),
                teaser=plain_text(entry.get("summary", "")),
                published=self._entry_date(entry),
            ))
        return discovery

    @staticmethod
    def _entry_date(entry: feedparser.FeedParserDict) -> datetime | None:
        # feedparser normalises every date format it understands to a UTC struct_time.
        parsed = entry.get("published_parsed") or entry.get("updated_parsed")
        if not parsed:
            return None
        return datetime.fromtimestamp(calendar.timegm(parsed), tz=timezone.utc)


class SitemapDiscoverer(Discoverer):
    async def discover(self, seed: Seed, state: SourceState) -> Discovery:
        discovery, body = await self._fetch(seed, state)
        if body is None:
            return discovery

        root = ElementTree.fromstring(body)
        if root.tag == f"{_SITEMAP_NS}sitemapindex":
            discovery.candidates = await self._from_index(seed, root, state)
        else:
            discovery.candidates = self._from_urlset(seed, root)
        return discovery

    async def _from_index(self, seed: Seed, root, state: SourceState) -> list[Candidate]:
        # Only open child sitemaps that changed since the last run.
        candidates: list[Candidate] = []
        for loc, lastmod in self._entries(root, "sitemap"):
            if state.cursor and lastmod and lastmod <= state.cursor:
                continue
            resp = await self._http.get(loc)
            resp.raise_for_status()
            candidates += self._from_urlset(seed, ElementTree.fromstring(resp.content))
        return candidates

    def _from_urlset(self, seed: Seed, root) -> list[Candidate]:
        pattern = re.compile(seed.link_pattern) if seed.link_pattern else None
        return [
            Candidate(url=normalize_url(loc), source=seed.name, title=title_from_slug(loc), published=lastmod)
            for loc, lastmod in self._entries(root, "url")
            if is_http_url(loc) and (pattern is None or pattern.search(loc))
        ]

    @staticmethod
    def _entries(root, kind: str):
        for node in root.iter(f"{_SITEMAP_NS}{kind}"):
            loc = (node.findtext(f"{_SITEMAP_NS}loc") or "").strip()
            if loc:
                yield loc, parse_date(node.findtext(f"{_SITEMAP_NS}lastmod"))


class PageDiscoverer(Discoverer):
    """Article links on an HTML listing page. Only same-site links matching the
    seed's link_pattern count; there are no dates, so these rely on the
    already-seen check alone."""

    async def discover(self, seed: Seed, state: SourceState) -> Discovery:
        if not seed.link_pattern:
            raise ValueError(f"Page seed {seed.name!r} needs a link_pattern")

        discovery, body = await self._fetch(seed, state)
        if body is None:
            return discovery

        pattern = re.compile(seed.link_pattern)
        host = urlsplit(seed.url).hostname
        found: dict[str, Candidate] = {}

        for anchor in lxml.html.fromstring(body).iter("a"):
            url = urljoin(seed.url, anchor.get("href", ""))
            if not is_http_url(url) or urlsplit(url).hostname != host or not pattern.search(url):
                continue
            url = normalize_url(url)
            title = plain_text(anchor.text_content(), 300)
            # A page often links one article several times (image, headline,
            # "read more"); keep the longest text, which is usually the headline.
            if url not in found or len(title) > len(found[url].title):
                found[url] = Candidate(url=url, source=seed.name, title=title)

        discovery.candidates = list(found.values())
        return discovery


class DiscovererRegistry:
    """Picks the discoverer for a seed's type."""

    def __init__(self, http: PoliteHttpClient) -> None:
        self._by_type: dict[SeedType, Discoverer] = {
            SeedType.FEED: FeedDiscoverer(http),
            SeedType.SITEMAP: SitemapDiscoverer(http),
            SeedType.PAGE: PageDiscoverer(http),
        }

    def for_seed(self, seed: Seed) -> Discoverer:
        return self._by_type[seed.type]
