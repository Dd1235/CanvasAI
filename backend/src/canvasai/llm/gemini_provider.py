from __future__ import annotations

import google.generativeai as genai

from canvasai.config import get_settings


class GeminiProvider:
    name = "gemini"

    def __init__(self) -> None:
        settings = get_settings()

        genai.configure(api_key=settings.gemini_api_key)

        self.model = genai.GenerativeModel(
            settings.gemini_model
        )

    async def complete(
        self,
        *,
        system: str,
        user: str,
    ) -> str:
        prompt = f"""
SYSTEM:
{system}

USER:
{user}
"""

        response = self.model.generate_content(prompt)

        return response.text