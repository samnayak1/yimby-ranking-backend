"""
Writes extracted + enriched data into the existing YIMBY Tracker SQLite DB.
Uses upsert (INSERT OR REPLACE) so it's safe to re-run.
"""
import aiosqlite
import datetime
from typing import Optional, List, Dict

from config import DB_PATH

CURRENT_YEAR = datetime.date.today().year


async def upsert_city(db: aiosqlite.Connection, city: Dict) -> Optional[int]:
    """Insert or update a city. Returns the city id."""
    cursor = await db.execute(
        """
        INSERT INTO cities (
            name,
            country_code,
            region,
            median_house_price,
            currency,
            notes,
            lat,
            lng,
            rating
        )
        VALUES (
            :name,
            :countryCode,
            :region,
            :medianHousePrice,
            :currency,
            :notes,
            :lat,
            :lng,
            :rating
        )
        ON CONFLICT(name, country_code) DO UPDATE SET
            region = excluded.region,
            median_house_price = COALESCE(excluded.median_house_price, cities.median_house_price),
            currency = COALESCE(excluded.currency, cities.currency),
            notes = COALESCE(excluded.notes, cities.notes),
            lat = COALESCE(excluded.lat, cities.lat),
            lng = COALESCE(excluded.lng, cities.lng),
            rating = COALESCE(excluded.rating, cities.rating),
            updated_at = datetime('now')
        RETURNING id
        """,
        {
            "name": city.get("name"),
            "countryCode": city.get("countryCode"),
            "region": city.get("region"),
            "medianHousePrice": city.get("medianHousePrice"),
            "currency": city.get("currency", "USD"),
            "notes": city.get("notes"),
            "lat": city.get("lat"),
            "lng": city.get("lng"),
            "rating": city.get("rating")
        },
    )

    row = await cursor.fetchone()
    return row[0] if row else None





async def upsert_politician(db: aiosqlite.Connection, pol: Dict) -> Optional[int]:
    cursor = await db.execute(
    """
    INSERT INTO politicians (
        name,
        designation,
        status,
        nationality_code,
        political_leaning,
        notes,
        rating
    )
    VALUES (
        :name,
        :designation,
        :status,
        :nationalityCode,
        :politicalLeaning,
        :notes,
        :rating
    )
    ON CONFLICT(name) DO UPDATE SET
        designation = COALESCE(excluded.designation, designation),
        status = COALESCE(excluded.status, status),
        nationality_code = COALESCE(excluded.nationality_code, nationality_code),
        political_leaning = COALESCE(excluded.political_leaning, political_leaning),
        notes = COALESCE(excluded.notes, notes),
        rating = COALESCE(excluded.rating, rating),
        updated_at = datetime('now')
    RETURNING id
    """,
    {
        "name": pol.get("name"),
        "designation": pol.get("designation"),
        "status": pol.get("status") or "INOFFICE",
        "nationalityCode": pol.get("nationalityCode"),
        "politicalLeaning": pol.get("politicalLeaning"),
        "notes": pol.get("notes"),
        "rating": pol.get("rating")
    },
)
    row = await cursor.fetchone()
    return row[0] if row else None




async def write_city(city_data: Dict):
    async with aiosqlite.connect(DB_PATH) as db:
        city_id = await upsert_city(db, city_data)
        await db.commit()
    return city_id


async def write_politician(pol_data: Dict):
    async with aiosqlite.connect(DB_PATH) as db:
        pol_id = await upsert_politician(db, pol_data)
        await db.commit()
    return pol_id