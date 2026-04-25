"""Document storage + vector search stubs.

Real implementation will:
  - upload bytes to a Supabase storage bucket (`documents`)
  - chunk + embed via the LLM provider
  - upsert embeddings into `document_chunks` (pgvector)
  - expose `search(query, k)` returning top-k chunks
"""

from __future__ import annotations

from typing import Any


async def upload(filename: str, content: bytes) -> dict[str, Any]:
    return {"filename": filename, "size": len(content), "stored": False}


async def search(query: str, k: int = 4) -> list[str]:
    _ = (query, k)
    return []
