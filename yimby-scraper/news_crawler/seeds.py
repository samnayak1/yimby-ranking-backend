from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

import yaml

from .models import Seed, SeedType
from .urls import is_http_url


class SeedLoader:
    """Reads and checks seeds.yaml, so a typo fails at start-up rather than
    halfway through a run."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def load(self, only: Iterable[str] = ()) -> list[Seed]:
        raw = yaml.safe_load(self._path.read_text()) or {}
        seeds = [self._parse(entry) for entry in raw.get("seeds", [])]

        names = [s.name for s in seeds]
        duplicates = {n for n in names if names.count(n) > 1}
        if duplicates:
            raise ValueError(f"Duplicate seed names in {self._path}: {', '.join(sorted(duplicates))}")

        only = set(only)
        if only:
            unknown = only - set(names)
            if unknown:
                raise ValueError(f"No seed named {', '.join(sorted(unknown))}")
            seeds = [s for s in seeds if s.name in only]
        return seeds

    def _parse(self, entry: dict) -> Seed:
        name = str(entry.get("name", "")).strip()
        url = str(entry.get("url", "")).strip()
        if not name or not is_http_url(url):
            raise ValueError(f"Seed needs a name and an http(s) url: {entry}")

        try:
            seed_type = SeedType(entry.get("type", "feed"))
        except ValueError:
            raise ValueError(f"Seed {name!r}: type must be one of {[t.value for t in SeedType]}") from None

        pattern = entry.get("link_pattern")
        if pattern is not None:
            re.compile(pattern)  # raises on a bad regex
        if seed_type is SeedType.PAGE and not pattern:
            raise ValueError(f"Seed {name!r}: page seeds need a link_pattern")

        return Seed(name=name, url=url, type=seed_type, link_pattern=pattern)
