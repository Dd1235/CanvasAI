"""OpenAI embeddings helper for the knowledge graph merge.

Used so that node-matching can fall back to semantic similarity when lexical
similarity is too brittle (e.g. "Map" vs "Hash Table"). Embeddings are
optional — if no API key is configured the helper degrades to returning
``None`` for every text, and the pipeline keeps using lexical similarity.
"""

from __future__ import annotations

import logging
import math

import httpx

from canvasai.config import get_settings

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


async def embed_texts(texts: list[str]) -> list[list[float] | None]:
    """Return one embedding per input text, or ``None`` when unavailable."""
    cleaned = [(text or "").strip() for text in texts]
    if not any(cleaned):
        return [None] * len(texts)

    settings = get_settings()
    if not settings.openai_api_key:
        return [None] * len(texts)

    payload_inputs = [text or " " for text in cleaned]
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": EMBEDDING_MODEL, "input": payload_inputs},
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        logger.warning("kg.embeddings: request failed (%s); skipping embeddings", exc)
        return [None] * len(texts)
    except ValueError as exc:
        logger.warning("kg.embeddings: malformed response (%s); skipping embeddings", exc)
        return [None] * len(texts)

    items = data.get("data") or []
    if len(items) != len(texts):
        logger.warning(
            "kg.embeddings: response count %d does not match input %d", len(items), len(texts)
        )
        return [None] * len(texts)
    return [list(item.get("embedding") or []) or None for item in items]


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for a, b in zip(left, right):
        dot += a * b
        left_norm += a * a
        right_norm += b * b
    if left_norm <= 0 or right_norm <= 0:
        return 0.0
    return dot / math.sqrt(left_norm * right_norm)
