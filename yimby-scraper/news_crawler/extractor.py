from __future__ import annotations

import asyncio
import json
import logging

import httpx
import trafilatura

from .discovery import parse_date
from .http_client import Disallowed, PoliteHttpClient
from .models import Article, Candidate

log = logging.getLogger(__name__)


class ArticleExtractor:
    """Fetches an article page and pulls out its main text, title and date."""

    def __init__(self, http: PoliteHttpClient, max_chars: int = 12_000) -> None:
        self._http = http
        # About 3,000 tokens: plenty to judge an article, and it caps the cost
        # of the occasional enormous page.
        self._max_chars = max_chars

    async def fetch(self, candidate: Candidate) -> Article | None:
        try:
            resp = await self._http.get(candidate.url)
            resp.raise_for_status()
        except (httpx.HTTPError, Disallowed) as err:
            log.warning("Could not fetch %s: %s", candidate.url, err)
            return None

        # Parsing a large page is CPU work; run it on a worker thread so other
        # seeds' downloads keep going meanwhile.
        extracted = await asyncio.to_thread(
            trafilatura.extract, resp.text,
            url=candidate.url, output_format="json", with_metadata=True, favor_precision=True,
        )
        if not extracted:
            log.warning("No article text found at %s", candidate.url)
            return None

        data = json.loads(extracted)
        return Article(
            candidate=candidate,
            title=data.get("title") or candidate.title,
            text=(data.get("text") or "")[: self._max_chars],
            published=candidate.published or parse_date(data.get("date")),
        )
