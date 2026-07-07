import json
from pathlib import Path

CACHE_FILE = Path("cache/geocode_cache.json")

CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)

if CACHE_FILE.exists():
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        _cache = json.load(f)
else:
    _cache = {}


def make_key(city: str, country: str) -> str:
    return f"{city.strip().lower()}|{country.strip().lower()}"


def get(city: str, country: str):
    return _cache.get(make_key(city, country))


def put(city: str, country: str, value: dict):
    _cache[make_key(city, country)] = value

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(_cache, f, indent=2, sort_keys=True)