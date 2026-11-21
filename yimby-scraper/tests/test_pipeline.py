import asyncio
import dataclasses
import sqlite3

from conftest import NOW, FakeClassifier, FakeDiscoverers, FakeExtractor, candidate, day, feed_seed

from news_crawler.pipeline import CrawlPipeline


def make(store, settings, discoverers, seeds=None, extractor=None, classifier=None):
    classifier = classifier or FakeClassifier()
    pipeline = CrawlPipeline(
        seeds=seeds or [feed_seed()], store=store, discoverers=discoverers,
        extractor=extractor or FakeExtractor(), classifier=classifier, settings=settings, now=lambda: NOW,
    )
    return pipeline, classifier


def rows(db_path, sql):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in conn.execute(sql)]
    finally:
        conn.close()


def test_stores_relevant_and_irrelevant_articles(store, settings, db_path):
    found = FakeDiscoverers({"Feed": [candidate(1, day(2)), candidate(2, day(1), relevant=False)]})
    pipeline, classifier = make(store, settings, found)

    stats = asyncio.run(pipeline.run())

    assert (stats.candidates, stats.classified, stats.relevant) == (2, 1, 1)
    assert classifier.classified == ["https://example.com/1"]
    articles = rows(db_path, "SELECT url, relevant, outcome, published_on, tags FROM news_articles ORDER BY url")
    assert articles == [
        {"url": "https://example.com/1", "relevant": 1, "outcome": "WIN", "published_on": "2026-11-19", "tags": '["zoning"]'},
        {"url": "https://example.com/2", "relevant": 0, "outcome": None, "published_on": "2026-11-20", "tags": "[]"},
    ]


def test_next_run_does_not_start_over(store, settings, db_path):
    items = [candidate(1, day(3)), candidate(2, day(2))]
    asyncio.run(make(store, settings, FakeDiscoverers({"Feed": items}))[0].run())

    # Next night the feed still lists both old items plus one new one.
    found = FakeDiscoverers({"Feed": items + [candidate(3, day(1))]})
    _, classifier = pipeline_and_run(store, settings, found)

    assert classifier.prefiltered == ["https://example.com/3"]
    assert found.states["Feed"].cursor == day(2)
    assert rows(db_path, "SELECT cursor FROM news_sources") == [{"cursor": day(1).isoformat()}]


def test_unchanged_feed_is_skipped_via_etag(store, settings):
    asyncio.run(make(store, settings, FakeDiscoverers({"Feed": [candidate(1, day(1))]}))[0].run())

    _, classifier = pipeline_and_run(store, settings, FakeDiscoverers({"Feed": []}, not_modified=["Feed"]))

    assert classifier.prefiltered == []


def test_run_cut_short_resumes_where_it_stopped(store, settings, db_path):
    items = [candidate(n, day(10 - n)) for n in range(1, 6)]  # 1 is oldest
    limited = dataclasses.replace(settings, max_classified_per_run=2)

    _, first = pipeline_and_run(store, limited, FakeDiscoverers({"Feed": items}))
    assert first.classified == ["https://example.com/1", "https://example.com/2"]
    state = rows(db_path, "SELECT cursor, etag FROM news_sources")[0]
    # The cursor stops at the last item handled, and the etag isn't kept, so
    # the next run can't be told "nothing changed".
    assert state == {"cursor": day(8).isoformat(), "etag": None}

    _, second = pipeline_and_run(store, settings, FakeDiscoverers({"Feed": items}))
    assert second.classified == [f"https://example.com/{n}" for n in (3, 4, 5)]


def test_first_run_ignores_old_items(store, settings):
    _, classifier = pipeline_and_run(store, settings, FakeDiscoverers({"Feed": [
        candidate(1, NOW.replace(month=9)), candidate(2, day(1)), candidate(3, None),
    ]}))

    assert classifier.prefiltered == ["https://example.com/2", "https://example.com/3"]


def test_failed_fetch_is_retried_next_run(store, settings):
    items = [candidate(1, None)]
    pipeline_and_run(store, settings, FakeDiscoverers({"Feed": items}), extractor=FakeExtractor(fail=["https://example.com/1"]))

    _, classifier = pipeline_and_run(store, settings, FakeDiscoverers({"Feed": items}))

    assert classifier.classified == ["https://example.com/1"]


def test_monthly_budget_stops_the_run(store, settings, db_path):
    seeds = [feed_seed("A"), feed_seed("B")]
    found = FakeDiscoverers({"A": [candidate(1, day(1), source="A")], "B": [candidate(2, day(1), source="B")]})
    tiny = dataclasses.replace(settings, monthly_budget_usd=0.00005)  # less than one pre-filter call

    stats, classifier = pipeline_and_run(store, tiny, found, seeds=seeds)

    assert stats.stopped_early == "monthly budget reached"
    assert classifier.classified == []
    run = rows(db_path, "SELECT status, error, input_tokens FROM news_crawl_runs")[0]
    assert run["status"] == "OK" and run["error"] == "monthly budget reached" and run["input_tokens"] > 0


def test_records_cost_of_each_run(store, settings, db_path):
    pipeline_and_run(store, settings, FakeDiscoverers({"Feed": [candidate(1, day(1))]}))

    run = rows(db_path, "SELECT status, candidates, relevant, input_tokens, output_tokens, cost_usd FROM news_crawl_runs")[0]
    assert run == {"status": "OK", "candidates": 1, "relevant": 1, "input_tokens": 2_100,
                   "output_tokens": 210, "cost_usd": settings.cost_usd(2_100, 210)}
    assert store.spent_this_month() == settings.cost_usd(2_100, 210)


def pipeline_and_run(store, settings, discoverers, **kwargs):
    pipeline, classifier = make(store, settings, discoverers, **kwargs)
    return asyncio.run(pipeline.run()), classifier


class SlowDiscoverers(FakeDiscoverers):
    """Each discovery takes a moment, and records how many ran at once."""

    def __init__(self, by_seed):
        super().__init__(by_seed)
        self.running = 0
        self.peak = 0

    async def discover(self, seed, state):
        self.running += 1
        self.peak = max(self.peak, self.running)
        await asyncio.sleep(0.01)
        self.running -= 1
        return await super().discover(seed, state)


def test_seeds_are_crawled_concurrently_up_to_the_limit(store, settings):
    seeds = [feed_seed(name) for name in "ABCDEF"]
    found = SlowDiscoverers({s.name: [candidate(i, day(1), source=s.name)] for i, s in enumerate(seeds)})

    stats, _ = pipeline_and_run(store, dataclasses.replace(settings, crawl_concurrency=3), found, seeds=seeds)

    assert found.peak == 3
    assert stats.candidates == 6


def test_per_run_limit_holds_across_concurrent_seeds(store, settings):
    seeds = [feed_seed(name) for name in "ABCD"]
    found = SlowDiscoverers({s.name: [candidate(10 * i + n, day(1), source=s.name) for n in range(3)]
                             for i, s in enumerate(seeds)})
    limited = dataclasses.replace(settings, crawl_concurrency=4, max_classified_per_run=5)

    stats, classifier = pipeline_and_run(store, limited, found, seeds=seeds, extractor=SlowExtractor())

    assert stats.classified == len(classifier.classified) == 5


class SlowExtractor(FakeExtractor):
    """Pauses mid-fetch, so seeds interleave while articles are being read."""

    async def fetch(self, candidate):
        await asyncio.sleep(0.01)
        return await super().fetch(candidate)
