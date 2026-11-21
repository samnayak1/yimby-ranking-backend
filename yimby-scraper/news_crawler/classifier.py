from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Literal, Sequence, TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

from .models import Article, Candidate, Classification, Outcome, Usage

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_TOPIC = """\
RELEVANT means news about housing supply or the rules that shape it: zoning and
land-use reform, housing bills and laws, permitting, approvals or rejections of
housing projects, construction starts and completions, transit-oriented
development, and YIMBY/NIMBY fights over new homes.

NOT relevant: celebrity or luxury homes, mortgage rates, home-buying tips,
interior design, crime at a property, and market or price reports that say
nothing about building, zoning or housing policy."""

PREFILTER_PROMPT = f"""\
You sort news headlines for a site that tracks pro-housing (YIMBY) wins and losses.

{_TOPIC}

Each line below is "<id>: <headline> | <teaser>". Return the ids of the
headlines that are likely relevant. When unsure, include it; a later step reads
the full article."""

CLASSIFY_PROMPT = f"""\
You read news articles for a site that tracks pro-housing (YIMBY) wins and losses.

{_TOPIC}

For a relevant article, also give:
- title: a clear, neutral headline (keep the original if it is fine).
- summary: 2-3 plain sentences on what happened and why it matters for housing supply.
- outcome: WIN if more homes were allowed, approved or built, or a pro-housing
  reform advanced; LOSS if homes were blocked, rejected or downzoned, or a reform
  failed; NEUTRAL otherwise (explainers, proposals not yet decided, mixed results).
- city_name: the main city, if the article is about one; otherwise null.
- country_code: ISO 3166-1 alpha-2 code of the country, e.g. US; null if unclear.
- tags: up to 4 lower-case topics, e.g. zoning, permits, transit, adu, rent, legislation.

For an article that is not relevant, set relevant to false and leave the rest null."""


class PrefilterResult(BaseModel):
    relevant_ids: list[int]


class ArticleAnalysis(BaseModel):
    relevant: bool
    title: str | None = None
    summary: str | None = None
    outcome: Literal["WIN", "LOSS", "NEUTRAL"] | None = None
    city_name: str | None = None
    country_code: str | None = Field(default=None, description="ISO 3166-1 alpha-2")
    tags: list[str] = Field(default_factory=list)


class Classifier(ABC):
    """Decides which links are housing news, and what each relevant article says."""

    def __init__(self) -> None:
        self.usage = Usage()

    @abstractmethod
    async def prefilter(self, candidates: Sequence[Candidate]) -> set[str]:
        """URLs of the candidates worth reading in full, judged on headline and teaser."""

    @abstractmethod
    async def classify(self, article: Article) -> Classification: ...


class GeminiClassifier(Classifier):
    BATCH_SIZE = 40  # headlines per pre-filter call
    MAX_ATTEMPTS = 3

    def __init__(self, api_key: str, model: str, thinking_level: str = "MINIMAL") -> None:
        super().__init__()
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._thinking = types.ThinkingConfig(thinking_level=types.ThinkingLevel(thinking_level))

    async def prefilter(self, candidates: Sequence[Candidate]) -> set[str]:
        keep: set[str] = set()
        for start in range(0, len(candidates), self.BATCH_SIZE):
            batch = candidates[start : start + self.BATCH_SIZE]
            lines = "\n".join(f"{i}: {c.title} | {c.teaser[:200]}" for i, c in enumerate(batch))
            result = await self._generate(PREFILTER_PROMPT, lines, PrefilterResult)
            keep |= {batch[i].url for i in result.relevant_ids if 0 <= i < len(batch)}
        return keep

    async def classify(self, article: Article) -> Classification:
        content = f"Headline: {article.title}\nSource: {article.candidate.source}\n\n{article.text}"
        result = await self._generate(CLASSIFY_PROMPT, content, ArticleAnalysis)
        if not result.relevant:
            return Classification(relevant=False)

        code = (result.country_code or "").strip().upper()
        return Classification(
            relevant=True,
            title=(result.title or article.title).strip(),
            summary=(result.summary or "").strip() or None,
            outcome=Outcome(result.outcome) if result.outcome else Outcome.NEUTRAL,
            city_name=(result.city_name or "").strip() or None,
            country_code=code if len(code) == 2 and code.isalpha() else None,
            tags=tuple(dict.fromkeys(t.strip().lower() for t in result.tags if t.strip()))[:4],
        )

    async def _generate(self, instructions: str, content: str, schema: type[T]) -> T:
        config = types.GenerateContentConfig(
            system_instruction=instructions,
            response_mime_type="application/json",
            response_schema=schema,
            thinking_config=self._thinking,
            temperature=0.1,
        )
        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            try:
                response = await self._client.aio.models.generate_content(model=self._model, contents=content, config=config)
                break
            except errors.APIError as err:
                # Rate limits and server errors are worth a retry; bad requests aren't.
                if attempt == self.MAX_ATTEMPTS or not (err.code == 429 or err.code >= 500):
                    raise
                log.warning("Gemini error %s, retrying (%d/%d)", err.code, attempt, self.MAX_ATTEMPTS)
                await asyncio.sleep(2 ** attempt)

        meta = response.usage_metadata
        if meta:
            self.usage.add(
                meta.prompt_token_count or 0,
                (meta.candidates_token_count or 0) + (meta.thoughts_token_count or 0),
            )
        if response.parsed is None:
            raise ValueError(f"Gemini returned no parseable JSON: {response.text!r:.200}")
        return response.parsed
