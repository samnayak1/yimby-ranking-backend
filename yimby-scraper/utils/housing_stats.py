"""
Fetches housing statistics per city per year.

US:   Census Bureau Building Permits Survey + ACS (population, median home value)
EU:   Eurostat (permits, population) — city-level data is limited so we do best-effort
"""

import datetime
from extractors.llm_extractor import infer_housing_stats


async def fetch_housing_stats(
    city: str,
    country_code: str,
    years: list[int],
) -> list[dict]:

    stats = await infer_housing_stats(
        city,
        country_code,
        years,
    )



    if stats:
        print(f"  [housing] {city} ({country_code}) → {len(stats)} years of stats inferred")
        return stats


