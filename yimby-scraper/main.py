"""
main

Pass 1: Fetch all posts from r/yimby
Pass 2: LLM discovers which cities + politicians are mentioned
Pass 3: LLM extracts structured data for each entity
Pass 4: Enrich cities with coordinates + housing stats
Pass 5: Upsert everything into SQLite

"""
import asyncio
import datetime
from tqdm.asyncio import tqdm

from config import YEARS_BACK
from scrapers.reddit import fetch_posts, chunk_posts, bundle_for_entity
from extractors.llm_extractor import discover_all_entities, extract_city, extract_politician
from utils.geocoder import geocode
from utils.housing_stats import fetch_housing_stats
from db.writer import write_city, write_politician
from db.file_writer import save_json
CURRENT_YEAR = datetime.date.today().year
TARGET_YEARS = list(range(CURRENT_YEAR - YEARS_BACK, CURRENT_YEAR + 1))
WRITE_TO_DB = True
OUTPUT_DIR = "output"

async def process_city(name: str, posts) -> bool:
    text = bundle_for_entity(posts, name)
    if not text:
        print(f"  [city] No relevant posts for {name} — skipping")
        return False

    data = await extract_city(name, text)
    if not data:
        print(f"  [city] Extraction failed for {name}")
        return False

    # Geocode if missing
    if not data.get("lat") or not data.get("lng"):
        coords = await geocode(data.get("name", name), data.get("country", ""))
        if coords:
            data.update(coords)

    # Housing stats
    stats = await fetch_housing_stats(
        name,
        data.get("countryCode", ""),
        TARGET_YEARS,
    )

    # Fill median price from stats if LLM didn't get it
    if not data.get("medianHousePrice") and stats:
        latest = next((s for s in reversed(stats) if s.get("medianHousePrice")), None)
        if latest:
            data["medianHousePrice"] = latest["medianHousePrice"]
            data["currency"]         = latest.get("currency", "USD")

        if WRITE_TO_DB:
            city_id = await write_city(data, stats)
            print(f"  [city] ✓ {name} → id={city_id}")
        else:
            save_json(
                "city",
                 name,
                {
                   "city": data,
                    "stats": stats,
              },
            )
        print(f"  [city] ✓ {name} → saved to file")

    return True


async def process_politician(name: str, posts) -> bool:
    text = bundle_for_entity(posts, name)
    if not text:
        print(f"  [politician] No relevant posts for {name} — skipping")
        return False

    data = await extract_politician(name, text)
    if not data:
        print(f"  [politician] Extraction failed for {name}")
        return False

    if WRITE_TO_DB:
        pol_id = await write_politician(data)
        print(f"  [politician] ✓ {name} → id={pol_id}")
    else:
        save_json(
            "politician",
            name,
            data,
        )
        print(f"  [politician] ✓ {name} → saved to file")

    return True


async def main():
    print("=" * 60)
    print("YIMBY Scraper — LLM-driven discovery mode")
    print("=" * 60)

    # fetch posts from Reddit
    posts  = await fetch_posts()
    chunks = chunk_posts(posts, chunk_size=30)
    print(f"Split into {len(chunks)} chunks for discovery.")


    print("\nPass 1 — Discovering entities from posts...")
    entities = await discover_all_entities(chunks)
    cities      = entities["cities"]
    politicians = entities["politicians"]


    sem = asyncio.Semaphore(2)  #two concurrent tasks at a time

    async def safe_process_city(name: str):
        async with sem:
            await process_city(name, posts)
            await asyncio.sleep(0.4)

    async def safe_process_politician(name: str):
        async with sem:
            await process_politician(name, posts)
            await asyncio.sleep(0.4)

    print(f"\nPass 2 — Extracting {len(cities)} cities...")
    await asyncio.gather(*[safe_process_city(c) for c in cities])

    print(f"\nPass 3 — Extracting {len(politicians)} politicians...")
    await asyncio.gather(*[safe_process_politician(p) for p in politicians])

    print("\n" + "=" * 60)
    print(f"Done. Processed {len(cities)} cities, {len(politicians)} politicians.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())