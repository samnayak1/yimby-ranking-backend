"""
Enriches city data with coordinates via OpenStreetMap Nominatim.
Free, no API key needed. Rate-limited to 1 req/sec per OSM policy.
"""
import asyncio
import httpx
from typing import Optional
from utils import geocode_cache


async def geocode(city: str, country: str) -> Optional[dict]:
    """Returns {lat, lng} or None if not found."""
    query = f"{city}, {country}"
    url   = "https://nominatim.openstreetmap.org/search"
    params = {
        "q":              query,
        "format":         "json",
        "limit":          1,
        "addressdetails": 1,
    }
    headers = {
        "User-Agent":      "yimby-scraper/1.0",
        "Accept-Language": "en",
    }

    async with httpx.AsyncClient() as client:
        try:
            cached = geocode_cache.get(city, country)
            if cached:
                return cached
            res  = await client.get(url, params=params, headers=headers, timeout=10)
            print(res.status_code)
            print(res.text[:500])
            data = res.json()
            if not data:
                return None

            hit = data[0]
            coords = {
                "lat": float(hit["lat"]),
                "lng": float(hit["lon"]),
            }
            geocode_cache.put(city, country, coords)
            return coords
        except Exception as e:
            print(f"  [geocode] Failed for {query}: {e}")
            return None
        finally:
            # OSM requires max 1 req/sec
            await asyncio.sleep(1.1)