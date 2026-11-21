from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Sequence
from xml.etree.ElementTree import ParseError

import httpx

from .classifier import Classifier
from .config import Settings
from .discovery import DiscovererRegistry
from .extractor import ArticleExtractor
from .http_client import Disallowed
from .models import Candidate, Classification, RunStats, Seed, SourceState
from .store import NewsStore

log = logging.getLogger(__name__)

_NOT_RELEVANT = Classification(relevant=False)


class CrawlPipeline:
    """One crawler run over every seed, several seeds at a time.

    How a run avoids starting over:
      * every link looked at is stored, so it's never fetched or paid for twice;
      * each seed keeps a cursor (newest item fully handled), and items older
        than it are dropped before any lookup;
      * an unchanged feed answers the conditional GET with a 304.
    Within a seed, items are handled oldest first, and the cursor and
    validators are only saved past what was actually handled, so a run cut
    short by a limit or a crash leaves the rest for the next one.

    Seeds run concurrently (settings.crawl_concurrency at a time); the HTTP
    client still gives each site one request at a time. All of this runs on
    one event loop, so the shared counters below need no locks, but limits are
    reserved before each await so concurrent seeds can't both take the last slot.
    """

    def __init__(
        self,
        seeds: Sequence[Seed],
        store: NewsStore,
        discoverers: DiscovererRegistry,
        extractor: ArticleExtractor,
        classifier: Classifier,
        settings: Settings,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self._seeds = seeds
        self._store = store
        self._discoverers = discoverers
        self._extractor = extractor
        self._classifier = classifier
        self._settings = settings
        self._now = now
        self._stats = RunStats()
        self._budget_left = 0.0

    async def run(self) -> RunStats:
        self._stats = RunStats()
        self._budget_left = self._settings.monthly_budget_usd - self._store.spent_this_month()
        run_id = self._store.start_run()
        slots = asyncio.Semaphore(self._settings.crawl_concurrency)
        error: str | None = None

        async def crawl(seed: Seed) -> None:
            async with slots:
                if not self._stats.stopped_early:
                    await self._crawl(seed)

        try:
            # A TaskGroup cancels the other seeds if one fails outright (e.g.
            # Gemini down), rather than leaving them writing after the run ends.
            async with asyncio.TaskGroup() as group:
                for seed in self._seeds:
                    group.create_task(crawl(seed))
        except Exception as err:
            cause = err.exceptions[0] if isinstance(err, ExceptionGroup) else err
            error = f"{type(cause).__name__}: {cause}"
            raise
        finally:
            usage = self._classifier.usage
            self._store.finish_run(run_id, self._stats, usage, self._run_cost(), error)
            log.info(
                "Run %s: %d new links, %d read in full, %d relevant, %d/%d tokens, $%.4f%s",
                "failed" if error else "done", self._stats.candidates, self._stats.classified,
                self._stats.relevant, usage.input_tokens, usage.output_tokens, self._run_cost(),
                f" (stopped early: {self._stats.stopped_early})" if self._stats.stopped_early else "",
            )
        return self._stats

    # ---- one seed -------------------------------------------------------

    async def _crawl(self, seed: Seed) -> None:
        state = self._store.source_state(seed)
        try:
            discovery = await self._discoverers.for_seed(seed).discover(seed, state)
        except (httpx.HTTPError, Disallowed, ParseError, ValueError) as err:
            log.warning("%s: discovery failed: %s", seed.name, err)
            self._store.save_source_state(seed, state, error=f"{type(err).__name__}: {err}")
            return

        if discovery.not_modified:
            log.info("%s: unchanged since last run", seed.name)
            self._store.save_source_state(seed, state)
            return

        fresh = [c for c in _unique(discovery.candidates) if self._is_fresh(c, state.cursor)]
        seen = self._store.seen(c.url for c in fresh)
        todo = sorted((c for c in fresh if c.url not in seen), key=_oldest_first)

        handled = await self._process(todo)
        finished = handled == len(todo)
        log.info("%s: %d links, %d new, %d handled", seed.name, len(discovery.candidates), len(todo), handled)

        dated = [c.published for c in (fresh if finished else todo[:handled]) if c.published]
        cursor = max(dated + ([state.cursor] if state.cursor else []), default=None)
        # Validators are only kept when the whole feed was handled: otherwise
        # the next run would get a 304 and never see the leftovers.
        self._store.save_source_state(seed, SourceState(
            cursor=cursor,
            etag=discovery.etag if finished else None,
            last_modified=discovery.last_modified if finished else None,
        ))

    async def _process(self, todo: list[Candidate]) -> int:
        """Pre-filters, reads and stores candidates in order. Returns how many
        were handled, always a prefix of todo."""
        allowance = max(self._settings.max_candidates_per_run - self._stats.candidates, 0)
        batch = todo[:allowance]
        if len(batch) < len(todo):
            self._stop("per-run link limit reached")
        if not batch:
            return 0
        if not self._can_spend():
            self._stop("monthly budget reached")
            return 0

        self._stats.candidates += len(batch)  # reserved before the await
        keep = await self._classifier.prefilter(batch)

        for index, candidate in enumerate(batch):
            if candidate.url not in keep:
                self._store.save_article(candidate, _NOT_RELEVANT)
                continue
            if self._stats.classified >= self._settings.max_classified_per_run:
                self._stop("per-run article limit reached")
                return index
            if not self._can_spend():
                self._stop("monthly budget reached")
                return index
            await self._read(candidate)

        return len(batch)

    async def _read(self, candidate: Candidate) -> None:
        self._stats.classified += 1  # reserved before the awaits
        article = await self._extractor.fetch(candidate)
        if article is None:
            # Not stored, so a link that failed to load is tried again next run
            # if it's still in the feed and newer than the cursor.
            self._stats.classified -= 1
            return

        result = await self._classifier.classify(article)
        self._store.save_article(candidate, result, title=article.title, published=article.published)
        if result.relevant:
            self._stats.relevant += 1

    # ---- helpers --------------------------------------------------------

    def _is_fresh(self, candidate: Candidate, cursor: datetime | None) -> bool:
        if candidate.published is None:
            return True  # undated: only the already-seen check applies
        if candidate.published < self._now() - timedelta(days=self._settings.max_age_days):
            return False
        # Only strictly older items are dropped: one with the cursor's exact
        # timestamp may not have been handled, and the seen check catches the
        # one that was.
        return cursor is None or candidate.published >= cursor

    def _run_cost(self) -> float:
        usage = self._classifier.usage
        return self._settings.cost_usd(usage.input_tokens, usage.output_tokens)

    def _can_spend(self) -> bool:
        # Checked before each Gemini call. With seeds running concurrently, up
        # to crawl_concurrency calls can be in flight, so the budget can be
        # overshot by that many calls (a fraction of a cent each).
        return self._run_cost() < self._budget_left

    def _stop(self, reason: str) -> None:
        if not self._stats.stopped_early:
            log.warning("Stopping early: %s", reason)
            self._stats.stopped_early = reason


def _unique(candidates: list[Candidate]) -> list[Candidate]:
    """First occurrence of each URL, in the original order."""
    seen: set[str] = set()
    unique = []
    for candidate in candidates:
        if candidate.url not in seen:
            seen.add(candidate.url)
            unique.append(candidate)
    return unique


def _oldest_first(candidate: Candidate) -> tuple[bool, datetime]:
    # Undated links go last: they don't move the cursor either way.
    return (candidate.published is None, candidate.published or datetime.max.replace(tzinfo=timezone.utc))
