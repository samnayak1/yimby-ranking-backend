"""
YIMBY Scraper — two-stage pipeline in one file.

Stage 1 (scrape):  fetch Reddit posts → save to disk
Stage 2 (extract): load from disk → LLM extraction → DB

Usage:
    python main.py                  # full pipeline
    python main.py --stage scrape   # stage 1 only
    python main.py --stage extract  # stage 2 only (reuses latest scraped data)
    python main.py --reextract      # stage 2, ignore cached LLM extractions
    python main.py --only cities
    python main.py --only politicians
"""
import asyncio
import datetime
import json
import argparse
from pathlib import Path

from config import YEARS_BACK
from scrapers.reddit import fetch_posts, chunk_posts, bundle_for_entity, Post
from extractors.llm_extractor import discover_all_entities, extract_city, extract_politician, infer_coordinates
from utils.geocoder import geocode
from utils.housing_stats import fetch_housing_stats
from db.writer import write_city, write_politician
from db.file_writer import save_json

CURRENT_YEAR = datetime.date.today().year
TARGET_YEARS = list(range(CURRENT_YEAR - YEARS_BACK, CURRENT_YEAR + 1))
WRITE_TO_DB  = True

# ── Intermediate data paths ───────────────────────────────────

DATA         = Path("data")
RAW          = DATA / "raw"
BUNDLES      = RAW  / "bundles"
DISCOVERED   = DATA / "discovered"
EXTRACTED    = DATA / "extracted"

for d in [RAW, BUNDLES, DISCOVERED, EXTRACTED]:
    d.mkdir(parents=True, exist_ok=True)

def today() -> str:
    return datetime.date.today().isoformat()

def _safe(name: str) -> str:
    return name.replace(" ", "_").replace("/", "-")

def raw_posts_path()         -> Path: return RAW        / f"posts_{today()}.json"
def discovered_path()        -> Path: return DISCOVERED  / f"entities_{today()}.json"
def bundle_path(t, name)     -> Path: return BUNDLES     / f"{t}_{_safe(name)}.json"
def extracted_path(t, name)  -> Path: return EXTRACTED   / f"{t}_{_safe(name)}.json"

def latest(directory: Path, pattern: str) -> Path | None:
    files = sorted(directory.glob(pattern), reverse=True)
    return files[0] if files else None

def _write(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

def _read(path: Path):
    return json.loads(path.read_text())

def _posts_to_dicts(posts: list[Post]) -> list[dict]:
    return [{"title": p.title, "body": p.body, "score": p.score,
             "url": p.url, "flair": p.flair, "comments": p.comments}
            for p in posts]

def _dicts_to_posts(dicts: list[dict]) -> list[Post]:
    return [Post(**d) for d in dicts]


# ── Stage 1: Scrape ───────────────────────────────────────────

async def stage_scrape() -> tuple[list[Post], dict]:
    """Fetch posts, run discovery, save everything to disk."""

    # Fetch posts (or reuse today's if already scraped)
    rp = raw_posts_path()
    if rp.exists():
        print(f"Loading existing posts from {rp}...")
        posts = _dicts_to_posts(_read(rp))
        print(f"Loaded {len(posts)} posts.")
    else:
        posts = await fetch_posts()
        _write(rp, _posts_to_dicts(posts))
        print(f"Saved {len(posts)} raw posts → {rp}")

    # Discovery (or reuse today's if already discovered)
    dp = discovered_path()
    if dp.exists():
        print(f"Loading existing discovered entities from {dp}...")
        entities = _read(dp)
    else:
        print("\nRunning LLM discovery pass...")
        chunks   = chunk_posts(posts, chunk_size=30)
        entities = await discover_all_entities(chunks)
        _write(dp, entities)
        print(f"Saved discovered entities → {dp}")

    # Bundle posts per entity
    print("\nBundling posts per entity...")
    for name in entities.get("cities", []):
        text = bundle_for_entity(posts, name)
        if text:
            _write(bundle_path("city", name),
                   {"entity_type": "city", "name": name, "text": text})

    for name in entities.get("politicians", []):
        text = bundle_for_entity(posts, name)
        if text:
            _write(bundle_path("politician", name),
                   {"entity_type": "politician", "name": name, "text": text})

    print(f"\n✓ Stage 1 done — {len(entities.get('cities',[]))} cities, "
          f"{len(entities.get('politicians',[]))} politicians discovered.")
    return posts, entities


# ── Stage 2: Extract ──────────────────────────────────────────

async def process_city(name: str, posts: list[Post], reextract: bool = False) -> bool:
    ext = extracted_path("city", name)
    bun = bundle_path("city", name)

    # Load or create LLM extraction
    if ext.exists() and not reextract:
        print(f"  [city] Using cached extraction for {name}")
        data = _read(ext)
    else:
        if not bun.exists():
            # Fall back to bundling on the fly from in-memory posts
            text = bundle_for_entity(posts, name)
        else:
            text = _read(bun)["text"]

        if not text:
            print(f"  [city] No relevant posts for {name} — skipping")
            return False

        data = await extract_city(name, text)
        if not data:
            print(f"  [city] Extraction failed for {name}")
            return False

        _write(ext, data)

    # Geocode if missing
    if not data.get("lat") or not data.get("lng"):
        coords = await infer_coordinates(data.get("name", name), data.get("country", ""))
        if not coords:
            coords = await geocode(data.get("name", name), data.get("country", ""))
        if coords:
            data.update(coords)
            _write(ext, data)   # update cache with coords

    # Housing stats
    stats = await fetch_housing_stats(name, data.get("countryCode", ""), TARGET_YEARS)

    # Fill median price from stats if missing
    if not data.get("medianHousePrice") and stats:
        latest_stat = next((s for s in reversed(stats) if s.get("medianHousePrice")), None)
        if latest_stat:
            data["medianHousePrice"] = latest_stat["medianHousePrice"]
            data["currency"]         = latest_stat.get("currency", "USD")
            _write(ext, data)

    if WRITE_TO_DB:
        city_id = await write_city(data, stats)
        print(f"  [city] ✓ {name} → DB id={city_id}")
    else:
        save_json("city", name, {"city": data, "stats": stats})
        print(f"  [city] ✓ {name} → saved to file")

    return True


async def process_politician(name: str, posts: list[Post], reextract: bool = False) -> bool:
    ext = extracted_path("politician", name)
    bun = bundle_path("politician", name)

    if ext.exists() and not reextract:
        print(f"  [politician] Using cached extraction for {name}")
        data = _read(ext)
    else:
        if not bun.exists():
            text = bundle_for_entity(posts, name)
        else:
            text = _read(bun)["text"]

        if not text:
            print(f"  [politician] No relevant posts for {name} — skipping")
            return False

        data = await extract_politician(name, text)
        if not data:
            print(f"  [politician] Extraction failed for {name}")
            return False

        _write(ext, data)

    if WRITE_TO_DB:
        pol_id = await write_politician(data)
        print(f"  [politician] ✓ {name} → DB id={pol_id}")
    else:
        save_json("politician", name, data)
        print(f"  [politician] ✓ {name} → saved to file")

    return True


async def stage_extract(
    entities: dict,
    posts: list[Post],
    reextract: bool = False,
    only: str | None = None,
) -> None:
    sem = asyncio.Semaphore(2)

    async def safe_city(name):
        async with sem:
            await process_city(name, posts, reextract)
            await asyncio.sleep(0.4)

    async def safe_politician(name):
        async with sem:
            await process_politician(name, posts, reextract)
            await asyncio.sleep(0.4)

    cities      = entities.get("cities", [])
    politicians = entities.get("politicians", [])

    if only != "politicians":
        print(f"\nPass 2 — Extracting {len(cities)} cities...")
        await asyncio.gather(*[safe_city(c) for c in cities])

    if only != "cities":
        print(f"\nPass 3 — Extracting {len(politicians)} politicians...")
        await asyncio.gather(*[safe_politician(p) for p in politicians])


# ── Entry point ───────────────────────────────────────────────

async def main(stage: str | None, reextract: bool, only: str | None) -> None:
    print("=" * 60)
    print("YIMBY Scraper — LLM-driven discovery mode")
    print("=" * 60)

    if stage == "extract":
        # Load from disk — no Reddit call
        dp = latest(DISCOVERED, "entities_*.json")
        rp = latest(RAW, "posts_*.json")
        if not dp or not rp:
            print("No scraped data found. Run without --stage first.")
            return
        entities = _read(dp)
        posts    = _dicts_to_posts(_read(rp))
        print(f"Loaded {len(posts)} posts and discovered entities from disk.")
    else:
        posts, entities = await stage_scrape()

    if stage != "scrape":
        await stage_extract(entities, posts, reextract=reextract, only=only)

    print("\n" + "=" * 60)
    cities      = entities.get("cities", [])
    politicians = entities.get("politicians", [])
    print(f"Done. {len(cities)} cities, {len(politicians)} politicians.")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage",      choices=["scrape", "extract"],
                        help="Run only one stage")
    parser.add_argument("--reextract",  action="store_true",
                        help="Re-run LLM even if cached extraction exists")
    parser.add_argument("--only",       choices=["cities", "politicians"],
                        help="Process only one entity type")
    args = parser.parse_args()

    asyncio.run(main(stage=args.stage, reextract=args.reextract, only=args.only))