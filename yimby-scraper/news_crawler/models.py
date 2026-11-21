from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class SeedType(str, Enum):
    FEED = "feed"        # RSS or Atom
    SITEMAP = "sitemap"  # sitemap.xml (or a sitemap index)
    PAGE = "page"        # an HTML listing page; article links are read off it


class Outcome(str, Enum):
    WIN = "WIN"          # more homes allowed, approved or built; a pro-housing reform passed
    LOSS = "LOSS"        # homes blocked, rejected or downzoned; a reform failed
    NEUTRAL = "NEUTRAL"


@dataclass(frozen=True)
class Seed:
    name: str
    url: str
    type: SeedType
    # Sitemap and page seeds: a regex an article URL must match, which keeps
    # out about pages, author pages, listings and so on.
    link_pattern: str | None = None


@dataclass
class Candidate:
    """A link found on a seed, before anything has been fetched."""

    url: str  # already normalised
    source: str
    title: str = ""
    teaser: str = ""
    published: datetime | None = None  # always UTC-aware when set


@dataclass(frozen=True)
class Article:
    """A candidate after its page was fetched and the main text pulled out."""

    candidate: Candidate
    title: str
    text: str
    published: datetime | None


@dataclass(frozen=True)
class Classification:
    relevant: bool
    title: str | None = None
    summary: str | None = None
    outcome: Outcome | None = None
    city_name: str | None = None
    country_code: str | None = None
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class SourceState:
    """Where the last run got to on one seed."""

    cursor: datetime | None = None
    etag: str | None = None
    last_modified: str | None = None


@dataclass
class Discovery:
    candidates: list[Candidate] = field(default_factory=list)
    not_modified: bool = False
    etag: str | None = None
    last_modified: str | None = None


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0  # includes thinking tokens, which are billed as output

    def add(self, input_tokens: int, output_tokens: int) -> None:
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens


@dataclass
class RunStats:
    candidates: int = 0  # new links looked at (pre-filtered)
    classified: int = 0  # fetched and read in full by Gemini
    relevant: int = 0    # written as visible articles
    stopped_early: str | None = None  # why the run didn't finish every seed, if it didn't
