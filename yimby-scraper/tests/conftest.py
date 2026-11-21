from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

import pytest

from news_crawler.classifier import Classifier
from news_crawler.config import Settings
from news_crawler.models import Article, Candidate, Classification, Discovery, Outcome, Seed, SeedType, SourceState
from news_crawler.store import NewsStore

MIGRATIONS = Path(__file__).resolve().parents[2] / "drizzle"
NOW = datetime(2026, 11, 21, 0, 0, tzinfo=timezone.utc)


def day(n: int) -> datetime:
    """n days before NOW."""
    return NOW.replace(day=21 - n)


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    """A database built from the backend's own migrations, so these tests fail
    if the crawler and the schema drift apart."""
    path = tmp_path / "database.sqlite"
    conn = sqlite3.connect(path)
    for migration in sorted(MIGRATIONS.glob("*.sql")):
        for statement in migration.read_text().split("--> statement-breakpoint"):
            if statement.strip():
                conn.execute(statement)
    conn.commit()
    conn.close()
    return path


@pytest.fixture
def store(db_path: Path):
    s = NewsStore(db_path)
    yield s
    s.close()


@pytest.fixture
def settings(db_path: Path) -> Settings:
    return Settings(gemini_api_key="test", db_path=db_path, max_age_days=30)


class FakeClassifier(Classifier):
    """Relevant when the headline mentions "homes". Counts tokens like a real one."""

    def __init__(self) -> None:
        super().__init__()
        self.prefiltered: list[str] = []
        self.classified: list[str] = []

    async def prefilter(self, candidates: Sequence[Candidate]) -> set[str]:
        self.prefiltered += [c.url for c in candidates]
        self.usage.add(100 * len(candidates), 10)
        return {c.url for c in candidates if "homes" in c.title}

    async def classify(self, article: Article) -> Classification:
        self.classified.append(article.candidate.url)
        self.usage.add(2_000, 200)
        return Classification(relevant=True, title=article.title, summary="S.", outcome=Outcome.WIN,
                              country_code="US", tags=("zoning",))


class FakeExtractor:
    def __init__(self, fail: Sequence[str] = ()) -> None:
        self.fail = set(fail)

    async def fetch(self, candidate: Candidate) -> Article | None:
        if candidate.url in self.fail:
            return None
        return Article(candidate=candidate, title=candidate.title, text="Body.", published=candidate.published)


class FakeDiscoverers:
    """Serves a fixed list of candidates per seed, and records the state it was given."""

    def __init__(self, by_seed: dict[str, list[Candidate]], not_modified: Sequence[str] = ()) -> None:
        self.by_seed = by_seed
        self.not_modified = set(not_modified)
        self.states: dict[str, SourceState] = {}

    def for_seed(self, seed: Seed):
        return self

    async def discover(self, seed: Seed, state: SourceState) -> Discovery:
        self.states[seed.name] = state
        if seed.name in self.not_modified and state.etag:
            return Discovery(not_modified=True, etag=state.etag)
        return Discovery(candidates=list(self.by_seed.get(seed.name, [])), etag='"v1"')


def feed_seed(name: str = "Feed") -> Seed:
    return Seed(name=name, url=f"https://{name.lower()}.example/feed", type=SeedType.FEED)


def candidate(n: int, published: datetime | None, source: str = "Feed", relevant: bool = True) -> Candidate:
    return Candidate(url=f"https://example.com/{n}", source=source,
                     title=f"{n} new homes" if relevant else f"{n} celebrity mansion", published=published)
