"""Nightly housing-news crawler.

    python main.py                       # full run
    python main.py --dry-run             # read and classify, write nothing
    python main.py --seed "SF YIMBY"     # one seed (repeatable)
    python main.py --limit 10            # read at most 10 articles in full
"""
from __future__ import annotations

import argparse
import asyncio
import dataclasses
import logging
import sys

from dotenv import load_dotenv

from news_crawler.classifier import GeminiClassifier
from news_crawler.config import Settings
from news_crawler.discovery import DiscovererRegistry
from news_crawler.extractor import ArticleExtractor
from news_crawler.http_client import PoliteHttpClient
from news_crawler.pipeline import CrawlPipeline
from news_crawler.seeds import SeedLoader
from news_crawler.store import DryRunStore, NewsStore


class CrawlerApp:
    """Builds the pipeline from settings and command-line options, and runs it."""

    def __init__(self, settings: Settings, args: argparse.Namespace) -> None:
        if args.limit is not None:
            settings = dataclasses.replace(settings, max_classified_per_run=args.limit)
        self._settings = settings
        self._args = args

    async def run(self) -> int:
        settings = self._settings
        seeds = SeedLoader(settings.seeds_path).load(only=self._args.seed or ())
        store_class = DryRunStore if self._args.dry_run else NewsStore
        store = store_class(settings.db_path)

        try:
            async with PoliteHttpClient(
                user_agent=settings.user_agent,
                delay_seconds=settings.request_delay_seconds,
                timeout_seconds=settings.request_timeout_seconds,
            ) as http:
                pipeline = CrawlPipeline(
                    seeds=seeds,
                    store=store,
                    discoverers=DiscovererRegistry(http),
                    extractor=ArticleExtractor(http),
                    classifier=GeminiClassifier(
                        settings.gemini_api_key, settings.gemini_model, settings.gemini_thinking_level,
                    ),
                    settings=settings,
                )
                await pipeline.run()
        finally:
            store.close()
        return 0

    @staticmethod
    def parse_args(argv: list[str]) -> argparse.Namespace:
        parser = argparse.ArgumentParser(description="Crawl housing news into the YIMBY tracker database.")
        parser.add_argument("--dry-run", action="store_true", help="classify but write nothing; log results")
        parser.add_argument("--seed", action="append", metavar="NAME", help="crawl only this seed (repeatable)")
        parser.add_argument("--limit", type=int, metavar="N", help="read at most N articles in full")
        parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")
        return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    # Local runs read yimby-scraper/.env; in Docker the variables come from compose.
    load_dotenv()
    args = CrawlerApp.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    # httpx logs every request at INFO, which buries the crawler's own lines.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    return asyncio.run(CrawlerApp(Settings.from_env(), args).run())


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
