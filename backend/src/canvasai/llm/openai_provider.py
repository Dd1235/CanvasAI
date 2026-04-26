"""OpenAI provider for single-shot completions.

Degrades gracefully to a deterministic stub string when the API key is
missing OR when the call fails (network error, 401, 429, 5xx, malformed
response). This keeps the LangGraph pipeline running end-to-end during
local demos and prevents one bad key from killing the WebSocket.
"""

from __future__ import annotations

import logging

import httpx

from canvasai.config import get_settings

logger = logging.getLogger(__name__)


class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        self._settings = get_settings()

    def _stub(self, system: str, user: str, reason: str = "no key") -> str:
        return (
            f"[{self.name}/{self._settings.openai_model} stub: {reason}] "
            f"system={system[:40]!r} user={user[:80]!r}"
        )

    async def complete(self, *, system: str, user: str) -> str:
        if not self._settings.openai_api_key:
            return self._stub(system, user, reason="no key")

        try:
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
        except httpx.HTTPStatusError as exc:
            logger.warning("openai http %s — falling back to stub", exc.response.status_code)
            return self._stub(system, user, reason=f"http {exc.response.status_code}")
        except httpx.HTTPError as exc:
            logger.warning("openai network error %s — falling back to stub", exc)
            return self._stub(system, user, reason="network error")
        except (KeyError, ValueError) as exc:
            logger.warning("openai malformed response %s — falling back to stub", exc)
            return self._stub(system, user, reason="malformed response")

        try:
            content = data["choices"][0]["message"].get("content")
        except (KeyError, IndexError, TypeError):
            return self._stub(system, user, reason="empty response")
        return content.strip() if isinstance(content, str) else ""
