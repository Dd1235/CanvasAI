"""OpenAI provider for single-shot completions."""

from __future__ import annotations

import httpx

from canvasai.config import get_settings


class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        self._settings = get_settings()

    async def complete(self, *, system: str, user: str) -> str:
        if not self._settings.openai_api_key:
            return (
                f"[{self.name}/{self._settings.openai_model} stub] "
                f"system={system[:40]!r} user={user[:80]!r}"
            )

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._settings.openai_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.4,
                },
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"].get("content")
        return content.strip() if isinstance(content, str) else ""
