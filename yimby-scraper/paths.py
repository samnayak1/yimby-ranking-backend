"""
Central path definitions for the two-stage pipeline.
All intermediate data lives under data/ which is gitignored.
"""
import datetime
from pathlib import Path

ROOT      = Path(__file__).parent
DATA      = ROOT / "data"
RAW       = DATA / "raw"
BUNDLES   = RAW  / "bundles"
DISCOVERED = DATA / "discovered"
EXTRACTED  = DATA / "extracted"

# Create dirs if they don't exist
for d in [RAW, BUNDLES, DISCOVERED, EXTRACTED]:
    d.mkdir(parents=True, exist_ok=True)

def today() -> str:
    return datetime.date.today().isoformat()

def raw_posts_path(date: str | None = None) -> Path:
    return RAW / f"posts_{date or today()}.json"

def discovered_path(date: str | None = None) -> Path:
    return DISCOVERED / f"entities_{date or today()}.json"

def bundle_path(entity_type: str, name: str) -> Path:
    safe = name.replace(" ", "_").replace("/", "-")
    return BUNDLES / f"{entity_type}_{safe}.json"

def extracted_path(entity_type: str, name: str) -> Path:
    safe = name.replace(" ", "_").replace("/", "-")
    return EXTRACTED / f"{entity_type}_{safe}.json"

def latest_raw_posts() -> Path | None:
    """Returns the most recently created posts file."""
    files = sorted(RAW.glob("posts_*.json"), reverse=True)
    return files[0] if files else None

def latest_discovered() -> Path | None:
    files = sorted(DISCOVERED.glob("entities_*.json"), reverse=True)
    return files[0] if files else None