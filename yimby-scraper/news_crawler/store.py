from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from .discovery import parse_date
from .models import Candidate, Classification, RunStats, Seed, SourceState, Usage

log = logging.getLogger(__name__)

_REQUIRED_TABLES = {"news_articles", "news_sources", "news_crawl_runs"}


class NewsStore:
    """The crawler's view of the backend's SQLite database.

    The backend owns the schema (drizzle/0013_news_articles.sql) and runs the
    migrations; this class only reads and writes rows. Every write commits on
    its own, so a crash mid-run keeps everything done up to that point.
    """

    def __init__(self, path: Path | str) -> None:
        self._conn = sqlite3.connect(str(path), timeout=10)
        self._conn.row_factory = sqlite3.Row
        # The API and Litestream use the same file; wait for their writes
        # rather than failing with "database is locked".
        self._conn.execute("PRAGMA busy_timeout = 10000")
        self._check_schema()

    def close(self) -> None:
        self._conn.close()

    # ---- articles -------------------------------------------------------

    def seen(self, urls: Iterable[str]) -> set[str]:
        urls = list(urls)
        found: set[str] = set()
        for start in range(0, len(urls), 500):  # stay under SQLite's parameter limit
            chunk = urls[start : start + 500]
            marks = ",".join("?" * len(chunk))
            rows = self._conn.execute(f"SELECT url FROM news_articles WHERE url IN ({marks})", chunk)
            found |= {r["url"] for r in rows}
        return found

    def save_article(self, candidate: Candidate, result: Classification, title: str | None = None,
                     published: datetime | None = None) -> None:
        """Records a looked-at link. Irrelevant ones are stored too (relevant=0),
        which is what stops the crawler paying to read them again."""
        published = published or candidate.published
        with self._conn:
            self._conn.execute(
                """
                INSERT INTO news_articles
                  (url, source, title, summary, published_on, city_name, country_code, outcome, tags, relevant)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(url) DO NOTHING
                """,
                (
                    candidate.url,
                    candidate.source,
                    (result.title or title or candidate.title or candidate.url)[:500],
                    result.summary,
                    published.date().isoformat() if published else None,
                    result.city_name,
                    result.country_code,
                    result.outcome.value if result.outcome else None,
                    json.dumps(list(result.tags)),
                    int(result.relevant),
                ),
            )

    # ---- per-source progress --------------------------------------------

    def source_state(self, seed: Seed) -> SourceState:
        row = self._conn.execute(
            "SELECT cursor, etag, last_modified, url FROM news_sources WHERE name = ?", (seed.name,)
        ).fetchone()
        # A seed whose URL changed is a different feed: its old cursor and
        # validators mean nothing there.
        if row is None or row["url"] != seed.url:
            return SourceState()
        return SourceState(cursor=parse_date(row["cursor"]), etag=row["etag"], last_modified=row["last_modified"])

    def save_source_state(self, seed: Seed, state: SourceState, error: str | None = None) -> None:
        with self._conn:
            self._conn.execute(
                """
                INSERT INTO news_sources (name, url, cursor, etag, last_modified, last_crawled_at, last_error)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                  url = excluded.url, cursor = excluded.cursor, etag = excluded.etag,
                  last_modified = excluded.last_modified, last_crawled_at = excluded.last_crawled_at,
                  last_error = excluded.last_error
                """,
                (
                    seed.name, seed.url,
                    state.cursor.isoformat() if state.cursor else None,
                    state.etag, state.last_modified, _now(), error,
                ),
            )

    # ---- runs and budget ------------------------------------------------

    def start_run(self) -> int:
        with self._conn:
            return self._conn.execute("INSERT INTO news_crawl_runs (started_at) VALUES (?)", (_now(),)).lastrowid

    def finish_run(self, run_id: int, stats: RunStats, usage: Usage, cost_usd: float, error: str | None = None) -> None:
        with self._conn:
            self._conn.execute(
                """
                UPDATE news_crawl_runs SET finished_at = ?, status = ?, candidates = ?, relevant = ?,
                  input_tokens = ?, output_tokens = ?, cost_usd = ?, error = ?
                WHERE id = ?
                """,
                (_now(), "FAILED" if error else "OK", stats.candidates, stats.relevant,
                 usage.input_tokens, usage.output_tokens, cost_usd, error or stats.stopped_early, run_id),
            )

    def spent_this_month(self) -> float:
        month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")
        row = self._conn.execute(
            "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM news_crawl_runs WHERE started_at >= ?", (month_start,)
        ).fetchone()
        return float(row["total"])

    def _check_schema(self) -> None:
        rows = self._conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        missing = _REQUIRED_TABLES - {r["name"] for r in rows}
        if missing:
            raise SystemExit(
                f"Database is missing {', '.join(sorted(missing))}. "
                "Start the backend once so it runs its migrations, then try again."
            )


class DryRunStore(NewsStore):
    """Reads like the real store, so a dry run skips what's already been seen,
    but writes nothing: results go to the log instead."""

    def save_article(self, candidate: Candidate, result: Classification, title: str | None = None,
                     published: datetime | None = None) -> None:
        if result.relevant:
            log.info("[dry run] %s %s | %s | %s, %s | %s", result.outcome.value if result.outcome else "-",
                     result.title, candidate.url, result.city_name, result.country_code, result.summary)
        else:
            log.debug("[dry run] irrelevant: %s", candidate.title or candidate.url)

    def save_source_state(self, seed: Seed, state: SourceState, error: str | None = None) -> None:
        log.info("[dry run] %s cursor -> %s%s", seed.name, state.cursor, f" (error: {error})" if error else "")

    def start_run(self) -> int:
        return 0

    def finish_run(self, run_id: int, stats: RunStats, usage: Usage, cost_usd: float, error: str | None = None) -> None:
        pass


def _now() -> str:
    # Same shape as SQLite's datetime('now'), which the backend's defaults use,
    # so string comparisons between the two work.
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
