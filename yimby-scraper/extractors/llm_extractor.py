"""
Two-pass LLM pipeline:

Pass 1 — Discovery:
    Feed chunks of posts → LLM returns a list of cities and politicians mentioned.

Pass 2 — Extraction:
    For each discovered entity, feed relevant posts → LLM returns structured JSON.
"""
import json
import re
import asyncio
from typing import Optional, List, Dict
from langchain_core.messages import HumanMessage, SystemMessage

from typing import Optional, Dict

from pydantic import BaseModel, Field

from config import llm, YEARS_BACK
import datetime

CURRENT_YEAR = datetime.date.today().year

# ── Helpers ───────────────────────────────────────────────────


def _parse_json(text: str) -> Optional[dict | list]:
    text = re.sub(r"```json|```", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


# ── Pass 1: Discovery ─────────────────────────────────────────

DISCOVERY_SYSTEM = """
You are a housing policy analyst reading Reddit posts from r/yimby.

Your job is to identify:
1. Cities mentioned in the context of housing policy, zoning, permits, or development.
2. Politicians (by full name if possible) mentioned in the context of housing policy.

Only include entities where there is meaningful housing policy discussion — not just passing mentions.
Focus on US and European cities and politicians only.

Return ONLY a JSON object like this:
{
  "cities": ["Minneapolis", "Austin", "Berlin"],
  "politicians": ["Scott Wiener", "Sadiq Khan", "Eric Adams"]
}

No markdown. No explanation. Valid JSON only.
"""


async def discover_entities(chunk: str) -> Dict[str, List[str]]:
    """Pass 1: Ask the LLM what cities and politicians appear in this chunk."""
    response = await llm.ainvoke([
        SystemMessage(content=DISCOVERY_SYSTEM),
        HumanMessage(content=f"Posts:\n\n{chunk[:7000]}"),
    ])
    result = _parse_json(response.content)
    if isinstance(result, dict):
        return {
            "cities":      result.get("cities", []),
            "politicians": result.get("politicians", []),
        }
    return {"cities": [], "politicians": []}


async def discover_all_entities(chunks: List[str]) -> Dict[str, List[str]]:
    """
    Run discovery across all chunks concurrently (with a semaphore to
    avoid hitting DeepSeek rate limits).
    """
    sem = asyncio.Semaphore(3)   # max 3 concurrent LLM calls

    async def _discover(chunk: str) -> Dict:
        async with sem:
            result = await discover_entities(chunk)
            await asyncio.sleep(0.3)
            return result

    results = await asyncio.gather(*[_discover(c) for c in chunks])

    # Merge and deduplicate across chunks
    all_cities = set()
    all_politicians = set()
    for r in results:
        all_cities.update(r.get("cities", []))
        all_politicians.update(r.get("politicians", []))

    print(
        f"\nDiscovered {len(all_cities)} cities, {len(all_politicians)} politicians.")
    print(f"  Cities:     {sorted(all_cities)}")
    print(f"  Politicians: {sorted(all_politicians)}")

    return {
        "cities":      sorted(all_cities),
        "politicians": sorted(all_politicians),
    }


# ── Pass 2: Extraction ────────────────────────────────────────

CITY_SYSTEM = f"""
You are a housing policy analyst. You will be given Reddit posts from r/yimby about a specific city.

Extract a structured JSON object with these exact fields:

{{
  "name": "city name as commonly known",
  "country": "full country name e.g. United States, Germany",
  "region": "state or province e.g. California, Bavaria",
  "countryCode": "ISO 2-letter code e.g. US, DE, FR, GB",
  "notes": "2-3 sentence summary of this city's housing policy stance",
  "rating": "1-10 based on the rating scale",
  "ratings": [
    {{"year": {CURRENT_YEAR}, "rating": 7}},
    {{"year": {CURRENT_YEAR - 1}, "rating": 6}},
    ...one entry per year back to {CURRENT_YEAR - YEARS_BACK}
  ]
}}

Rating scale 1–10: 10 = most YIMBY (pro-housing, fast permits, upzoning).
1 = most NIMBY (blocking development, restrictive zoning).
Base the scores on sentiment in the posts. Vary them realistically year to year.

Return ONLY valid JSON. No markdown. No explanation.
"""

POLITICIAN_SYSTEM = f"""
You are a housing policy analyst. You will be given Reddit posts from r/yimby about a specific politician.

Extract a structured JSON object with these exact fields:

{{
  "name": "full name",
  "designation": "one of: President, Vice President, Prime Minister, Governor, Mayor, Senator, Comptroller, Chief Minister, Minister, MP, Councillor, Other",
  "isInOffice": 1 or 0,
  "nationality": "full nationality e.g. American, German, British",
  "nationalityCode": "ISO 2-letter country code e.g. US, DE, GB",
  "politicalLeaning": "one of: Liberal, Conservative, Democratic Socialist, Libertarian, Nationalist, Green",
  "notes": "2-3 sentence summary of their housing policy record",
  "rating": "1-10 based on the rating scale",
  "ratings": [
    {{"year": {CURRENT_YEAR}, "rating": 8}},
    {{"year": {CURRENT_YEAR - 1}, "rating": 7}},
    ...one entry per year back to {CURRENT_YEAR - YEARS_BACK}
  ]
}}

Rating scale 1–10: 10 = strongest YIMBY advocate. 1 = strongest NIMBY.
Base scores on sentiment in posts. Vary realistically year to year.

notes: Write a concise paragraph (80–150 words). 
Do NOT summarize the politician's biography.
Instead summarize what Reddit users think about this politician's housing policy.
Mention:
- what policies or actions people praise
- what criticisms repeatedly appear
- why people consider them more or less YIMBY
- whether commenters think they can actually deliver results
- any recurring disagreements or caveats
Write naturally, like a human summarizing an online discussion.
Do not use generic political language such as
"aimed at increasing housing production"
or
"critics argue".
Instead explain *why* commenters believe those things.
Talk as if it's your own opinion, but only include opinions supported by the provided posts.
Return ONLY valid JSON. No markdown. No explanation.
"""


async def extract_city(name: str, reddit_text: str) -> Optional[dict]:
    if not reddit_text.strip():
        return None
    response = await llm.ainvoke([
        SystemMessage(content=CITY_SYSTEM),
        HumanMessage(content=f"City: {name}\n\nPosts:\n{reddit_text[:6000]}"),
    ])
    result = _parse_json(response.content)
    if isinstance(result, dict):
        result["_entity_name"] = name
        return result
    return None


async def extract_politician(name: str, reddit_text: str) -> Optional[dict]:
    if not reddit_text.strip():
        return None
    response = await llm.ainvoke([
        SystemMessage(content=POLITICIAN_SYSTEM),
        HumanMessage(
            content=f"Politician: {name}\n\nPosts:\n{reddit_text[:6000]}"),
    ])
    result = _parse_json(response.content)
    if isinstance(result, dict):
        result["_entity_name"] = name
        return result
    return None


class HousingStats(BaseModel):
    year: int

    population: int | None = None

    medianHousePrice: int | None = None
    currency: str | None = None

    permitsIssued: int | None = None
    permitsPer1000Residents: float | None = None

    housingStarts: int | None = None
    homesCompleted: int | None = None

    averagePermitDays: int | None = None

    confidence: int = Field(
        description="0-100 confidence in these estimates"
    )


async def infer_housing_stats(
    city: str,
    country: str,
    years: list[int],
) -> list[dict]:

    prompt = f"""
Estimate the housing and development statistics for the following city.

City: {city}
Country: {country}

Years:
{", ".join(map(str, years))}

Return one object for each year.

Guidelines:
- Use your general knowledge of the city's housing market, demographics, and construction trends.
- Estimates are acceptable; exact official values are NOT required.
- Keep values internally consistent from year to year.
- Population should generally change gradually unless there was a major event.
- Median house prices should reflect known housing market trends.
- Housing starts, permits, and completions should be plausible relative to the city's size.
- Permits issued should usually be greater than or equal to homes completed.
- Average permit days should reflect how restrictive or efficient the city's permitting process is.
- Use local currency for medianHousePrice.
- If a statistic is genuinely impossible to estimate, return null instead of inventing an obviously unrealistic value.
- Prefer realistic estimates over precision.
- Return data for every requested year.

For each year estimate:
- population
- medianHousePrice
- currency
- permitsIssued
- permitsPer1000Residents
- housingStarts
- homesCompleted
- averagePermitDays
"""

    try:
        structured = llm.with_structured_output(list[HousingStats])

        results = await structured.ainvoke(prompt)

        return [r.model_dump() for r in results]

    except Exception:
        return []


class Coordinates(BaseModel):
    lat: float = Field(description="Latitude in decimal degrees")
    lng: float = Field(description="Longitude in decimal degrees")


async def infer_coordinates(
    city: str,
    country: str = "",
) -> Optional[Dict[str, float]]:
    """Ask the LLM for the coordinates of a city.

    Returns None if the LLM is unsure.
    """

    prompt = f"""
Provide the approximate geographic coordinates for this city.

City: {city}
Country: {country}

Rules:
- Return ONLY if you are confident.
- If the city is ambiguous or you are unsure, return null.
- Use decimal degrees.
"""

    try:
        structured = llm.with_structured_output(Coordinates)
        result = await structured.ainvoke(prompt)

        if result is None:
            return None

        return {
            "lat": result.lat,
            "lng": result.lng,
        }

    except Exception:
        return None
