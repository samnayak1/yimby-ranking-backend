import asyncio
from datetime import datetime, timezone

import httpx
import pytest

from news_crawler.discovery import DiscovererRegistry, title_from_slug
from news_crawler.http_client import Disallowed, PoliteHttpClient
from news_crawler.models import Seed, SeedType, SourceState
from news_crawler.seeds import SeedLoader
from news_crawler.urls import normalize_url

RSS = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title>Council approves 800 homes</title><link>https://site.example/a/?utm_source=rss#top</link>
<description>&lt;p&gt;The vote was 7-2.&lt;/p&gt;</description><pubDate>Thu, 19 Nov 2026 16:45:00 +0000</pubDate></item>
<item><title>No date</title><link>https://site.example/b</link></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>"""

SITEMAP = b"""<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://site.example/post/cherry-creek-breaks-ground</loc><lastmod>2026-11-19T17:09:58.596996Z</lastmod></url>
<url><loc>https://site.example/about</loc><lastmod>2026-11-20T00:00:00Z</lastmod></url>
</urlset>"""

PAGE = b"""<html><body>
<a href="/news/one"><img></a><a href="/news/one">Council approves homes</a>
<a href="https://other.example/news/two">Elsewhere</a><a href="/about">About</a>
</body></html>"""


class Site:
    """A fake web server for httpx: path -> (status, body, headers)."""

    def __init__(self, routes, robots=b"User-agent: *\nDisallow: /private\n"):
        self.routes = {"/robots.txt": (200, robots, {}), **routes}
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        status, body, headers = self.routes.get(request.url.path, (404, b"", {}))
        if request.headers.get("If-None-Match") and request.headers["If-None-Match"] == headers.get("ETag"):
            return httpx.Response(304)
        return httpx.Response(status, content=body, headers=headers)


def client(site: Site) -> PoliteHttpClient:
    return PoliteHttpClient("test", delay_seconds=0, transport=httpx.MockTransport(site.handler))


def discover(site, seed, state=SourceState()):
    async def go():
        async with client(site) as http:
            return await DiscovererRegistry(http).for_seed(seed).discover(seed, state)
    return asyncio.run(go())


def test_feed_items_become_candidates():
    site = Site({"/feed": (200, RSS, {"ETag": '"v1"'})})
    found = discover(site, Seed("S", "https://site.example/feed", SeedType.FEED))

    assert [c.url for c in found.candidates] == ["https://site.example/a", "https://site.example/b"]
    first = found.candidates[0]
    assert (first.title, first.teaser) == ("Council approves 800 homes", "The vote was 7-2.")
    assert first.published == datetime(2026, 11, 19, 16, 45, tzinfo=timezone.utc)
    assert found.candidates[1].published is None
    assert found.etag == '"v1"'


def test_unchanged_feed_returns_not_modified():
    site = Site({"/feed": (200, RSS, {"ETag": '"v1"'})})
    found = discover(site, Seed("S", "https://site.example/feed", SeedType.FEED), SourceState(etag='"v1"'))

    assert found.not_modified and found.candidates == []


def test_sitemap_filters_by_pattern_and_titles_from_slug():
    site = Site({"/sitemap.xml": (200, SITEMAP, {})})
    seed = Seed("S", "https://site.example/sitemap.xml", SeedType.SITEMAP, link_pattern=r"/post/")
    found = discover(site, seed)

    assert [(c.url, c.title) for c in found.candidates] == [
        ("https://site.example/post/cherry-creek-breaks-ground", "cherry creek breaks ground"),
    ]
    assert found.candidates[0].published.tzinfo is not None


def test_page_keeps_same_site_matching_links_once():
    site = Site({"/news": (200, PAGE, {})})
    found = discover(site, Seed("S", "https://site.example/news", SeedType.PAGE, link_pattern=r"/news/"))

    assert [(c.url, c.title) for c in found.candidates] == [("https://site.example/news/one", "Council approves homes")]


def test_robots_txt_is_obeyed():
    site = Site({"/private/feed": (200, RSS, {})})
    with pytest.raises(Disallowed):
        discover(site, Seed("S", "https://site.example/private/feed", SeedType.FEED))
    assert [r.url.path for r in site.requests] == ["/robots.txt"]


def test_missing_robots_txt_allows_everything():
    site = Site({"/feed": (200, RSS, {})})
    site.routes["/robots.txt"] = (404, b"", {})
    assert len(discover(site, Seed("S", "https://site.example/feed", SeedType.FEED)).candidates) == 2


def test_unreadable_robots_txt_blocks_the_site():
    site = Site({"/feed": (200, RSS, {})})
    site.routes["/robots.txt"] = (503, b"", {})
    with pytest.raises(Disallowed):
        discover(site, Seed("S", "https://site.example/feed", SeedType.FEED))


def test_requests_to_one_site_are_spaced_out_but_sites_overlap():
    site = Site({"/a": (200, b"", {}), "/b": (200, b"", {})})
    clock = [0.0]
    waits: list[float] = []

    async def sleep(seconds):
        waits.append(seconds)

    async def go():
        async with PoliteHttpClient("test", delay_seconds=2, transport=httpx.MockTransport(site.handler),
                                    clock=lambda: clock[0], sleep=sleep) as http:
            # robots.txt then /a on one site: one wait. A second site in
            # parallel waits only for its own robots.txt -> page gap.
            await asyncio.gather(http.get("https://site.example/a"), http.get("https://other.example/a"))
            await http.get("https://site.example/b")

    asyncio.run(go())
    assert waits == [2, 2, 2]  # site: robots->a, a->b; other: robots->a. Never across sites.


@pytest.mark.parametrize("raw, expected", [
    ("https://Site.example/a/?utm_source=x&b=2&a=1#frag", "https://site.example/a?a=1&b=2"),
    ("https://site.example:443/", "https://site.example/"),
    ("http://site.example/news/?cid=rss", "http://site.example/news"),
])
def test_normalize_url(raw, expected):
    assert normalize_url(raw) == expected


def test_title_from_slug():
    assert title_from_slug("https://x.example/post/big-box_backfill-done/") == "big box backfill done"


def test_seed_file_is_valid():
    # The real seeds.yaml: catches a typo before it reaches the server.
    from news_crawler.config import Settings
    seeds = SeedLoader(Settings(gemini_api_key="x").seeds_path).load()
    assert len(seeds) >= 20
    assert {s.type for s in seeds} == {SeedType.FEED, SeedType.SITEMAP}


def test_seed_loader_rejects_bad_seeds(tmp_path):
    path = tmp_path / "seeds.yaml"
    path.write_text("seeds:\n  - {name: A, url: 'https://a.example', type: page}\n")
    with pytest.raises(ValueError, match="link_pattern"):
        SeedLoader(path).load()

    path.write_text("seeds:\n  - {name: A, url: 'https://a.example'}\n  - {name: A, url: 'https://b.example'}\n")
    with pytest.raises(ValueError, match="Duplicate"):
        SeedLoader(path).load()
