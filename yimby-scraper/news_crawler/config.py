from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent


def _env(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value or default


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str = "gemini-3.5-flash-lite"
    # Thinking tokens are billed as output, the expensive side. MINIMAL keeps
    # them near zero; sorting headlines doesn't need more.
    gemini_thinking_level: str = "MINIMAL"
    # USD per million tokens, from Google's pricing page (standard paid tier).
    input_price_per_m: float = 0.30
    output_price_per_m: float = 2.50

    db_path: Path = _ROOT.parent / "db" / "database.sqlite"
    seeds_path: Path = _ROOT / "seeds.yaml"

    # Caps that keep one busy news day from running up the bill.
    max_candidates_per_run: int = 400   # new links pre-filtered per run
    max_classified_per_run: int = 100   # articles fetched and read in full per run
    monthly_budget_usd: float = 10.0
    # On a seed's first run (no cursor yet), ignore anything older than this,
    # so a sitemap with years of posts doesn't get crawled end to end.
    max_age_days: int = 30

    # Seeds crawled at the same time. Each site still gets one request at a
    # time; this is what lets different sites overlap.
    crawl_concurrency: int = 4
    request_delay_seconds: float = 2.0  # between requests to the same site
    request_timeout_seconds: float = 20.0
    # Optional page about the crawler, added to the User-Agent so site owners
    # can see who is visiting.
    contact_url: str | None = None

    @property
    def user_agent(self) -> str:
        contact = f"; +{self.contact_url}" if self.contact_url else ""
        return f"YimbyNewsCrawler/1.0 (feed reader{contact})"

    def cost_usd(self, input_tokens: int, output_tokens: int) -> float:
        return (input_tokens * self.input_price_per_m + output_tokens * self.output_price_per_m) / 1_000_000

    @classmethod
    def from_env(cls) -> Settings:
        key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not key:
            raise SystemExit("GEMINI_API_KEY is not set. Add it to .env (see .env.example).")

        d = cls(gemini_api_key=key)
        return cls(
            gemini_api_key=key,
            gemini_model=_env("GEMINI_MODEL", d.gemini_model),
            gemini_thinking_level=_env("GEMINI_THINKING_LEVEL", d.gemini_thinking_level).upper(),
            input_price_per_m=float(_env("GEMINI_INPUT_PRICE_PER_M", str(d.input_price_per_m))),
            output_price_per_m=float(_env("GEMINI_OUTPUT_PRICE_PER_M", str(d.output_price_per_m))),
            db_path=Path(_env("DB_PATH", str(d.db_path))),
            seeds_path=Path(_env("SEEDS_PATH", str(d.seeds_path))),
            max_candidates_per_run=int(_env("MAX_CANDIDATES_PER_RUN", str(d.max_candidates_per_run))),
            max_classified_per_run=int(_env("MAX_CLASSIFIED_PER_RUN", str(d.max_classified_per_run))),
            monthly_budget_usd=float(_env("MONTHLY_BUDGET_USD", str(d.monthly_budget_usd))),
            max_age_days=int(_env("MAX_AGE_DAYS", str(d.max_age_days))),
            crawl_concurrency=max(1, int(_env("CRAWL_CONCURRENCY", str(d.crawl_concurrency)))),
            request_delay_seconds=float(_env("REQUEST_DELAY_SECONDS", str(d.request_delay_seconds))),
            contact_url=os.environ.get("CRAWLER_CONTACT_URL", "").strip() or None,
        )
