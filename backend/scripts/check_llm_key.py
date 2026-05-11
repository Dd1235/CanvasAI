from __future__ import annotations

import asyncio

from canvasai.config import get_settings
from canvasai.llm.provider import get_provider


async def main() -> None:
    settings = get_settings()
    key = settings.openai_api_key or ""
    print(
        {
            "has_key": bool(key),
            "length": len(key),
            "starts_sk": key.startswith("sk-"),
            "starts_sk_proj": key.startswith("sk-proj-"),
            "has_whitespace": key != key.strip(),
            "model": settings.openai_model,
            "provider": settings.llm_provider,
        }
    )
    raw = await get_provider().complete(
        system='Return only JSON: {"ok": true}',
        user="Say ok as JSON.",
    )
    print(raw[:500])


if __name__ == "__main__":
    asyncio.run(main())
