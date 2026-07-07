"""
Fetches housing statistics per city per year.

US:   Census Bureau Building Permits Survey + ACS (population, median home value)
EU:   Eurostat (permits, population) — city-level data is limited so we do best-effort
"""
import asyncio
import httpx
from typing import Optional, List, Dict
import datetime

CURRENT_YEAR = datetime.date.today().year




CENSUS_PERMIT_URL = "https://api.census.gov/data/{year}/cbp"
ACS_URL = "https://api.census.gov/data/{year}/acs/acs5"

# Major US cities → FIPS place codes (extend as needed)
US_CITY_FIPS: Dict[str, Dict] = {
    "Minneapolis": {"state": "27", "place": "43000"},
    "Austin":      {"state": "48", "place": "05000"},
    "Houston":     {"state": "48", "place": "35000"},
    "Phoenix":     {"state": "04", "place": "55000"},
    "Denver":      {"state": "08", "place": "20000"},
    "Seattle":     {"state": "53", "place": "63000"},
    "Portland":    {"state": "41", "place": "59000"},
    "San Francisco": {"state": "06", "place": "67000"},
    "Los Angeles": {"state": "06", "place": "44000"},
    "New York":    {"state": "36", "place": "51000"},
    "Chicago":     {"state": "17", "place": "14000"},
    "Boston":      {"state": "25", "place": "07000"},
}


async def fetch_us_housing_stats(city: str, years: List[int]) -> List[Dict]:
    """Fetch Census ACS data: population + median home value per year."""
    fips = US_CITY_FIPS.get(city)
    if not fips:
        return []

    results = []
    async with httpx.AsyncClient() as client:
        for year in years:
            # ACS 5-year: population + median home value
            acs_year = min(year, CURRENT_YEAR - 1)   # ACS lags 1 year
            try:
                res = await client.get(
                    ACS_URL.format(year=acs_year),
                    params={
                        "get":      "B01003_001E,B25077_001E",  # population, median home value
                        "for":      f"place:{fips['place']}",
                        "in":       f"state:{fips['state']}",
                    },
                    timeout=15,
                )
                data = res.json()
                if len(data) > 1:
                    _, row = data[0], data[1]
                    population       = int(row[0]) if row[0] and row[0] != "-666666666" else None
                    median_home_value = int(row[1]) if row[1] and row[1] != "-666666666" else None
                    results.append({
                        "year":             year,
                        "population":       population,
                        "medianHousePrice": median_home_value,
                        "currency":         "USD",
                    })
            except Exception as e:
                print(f"  [census] {city} {year}: {e}")
            await asyncio.sleep(0.3)

    return results


# ── Eurostat ──────────────────────────────────────────────────

EUROSTAT_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/lfst_r_lfsd2pop"

EU_CITY_NUTS: Dict[str, str] = {
    "Berlin":    "DE300",
    "Munich":    "DE212",
    "Hamburg":   "DE600",
    "Paris":     "FR101",
    "Amsterdam": "NL329",
    "Vienna":    "AT130",
    "Stockholm": "SE110",
    "Oslo":      "NO012",
    "Copenhagen":"DK011",
    "London":    "UKI3",
    "Barcelona": "ES511",
    "Madrid":    "ES300",
    "Milan":     "ITC4C",
    "Rome":      "ITI43",
}


async def fetch_eu_housing_stats(city: str, years: List[int]) -> List[Dict]:
    """
    Eurostat city-level data is limited. We return population where available.
    Permit data at city level isn't reliably in Eurostat — noted as None.
    """
    nuts = EU_CITY_NUTS.get(city)
    if not nuts:
        return []

    results = []
    # Eurostat population by NUTS region
    url = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_r_pjangrp3"
    async with httpx.AsyncClient() as client:
        for year in years:
            try:
                res = await client.get(
                    url,
                    params={
                        "geo":    nuts,
                        "time":   str(year),
                        "sex":    "T",
                        "age":    "TOTAL",
                        "format": "JSON",
                    },
                    timeout=15,
                )
                data = res.json()
                values = data.get("value", {})
                pop = list(values.values())[0] if values else None
                results.append({
                    "year":             year,
                    "population":       int(pop) if pop else None,
                    "medianHousePrice": None,   # not available via Eurostat at city level
                    "currency":         None,
                })
            except Exception as e:
                print(f"  [eurostat] {city} {year}: {e}")
            await asyncio.sleep(0.3)

    return results


async def fetch_housing_stats(city: str, country_code: str, years: List[int]) -> List[Dict]:
    if country_code == "US":
        return await fetch_us_housing_stats(city, years)
    else:
        return await fetch_eu_housing_stats(city, years)