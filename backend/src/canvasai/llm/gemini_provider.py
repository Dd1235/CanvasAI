"""Gemini provider using LangChain library objects."""
from __future__ import annotations
import logging
from typing import Type, TypeVar
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from canvasai.config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

class GeminiProvider:
    name = "gemini"

    def __init__(self) -> None:
        self._settings = get_settings()

    async def complete(self, *, system: str, user: str, model: str | None = None) -> str:
        api_key = self._settings.gemini_api_key
        target_model = model or self._settings.gemini_model
        
        if not api_key:
            return f"[Stub: No API Key] sys={system[:20]} user={user[:20]}"

        try:
            llm = ChatGoogleGenerativeAI(
                google_api_key=api_key,
                model=target_model,
                temperature=0.2,
                max_retries=2,
                max_tokens=8192,
            )
            messages = [SystemMessage(content=system), HumanMessage(content=user)]
            response = await llm.ainvoke(messages)
            return str(response.content).strip()
        except Exception as e:
            logger.error(f"Gemini Error: {str(e)}")
            return f"[Error: {type(e).__name__}] {str(system[:20])}"

    async def structured_complete(
        self, *, model_schema: Type[T], system: str, user: str, model: str | None = None
    ) -> T:
        api_key = self._settings.gemini_api_key
        target_model = model or self._settings.gemini_model
        
        llm = ChatGoogleGenerativeAI(
            google_api_key=api_key,
            model=target_model,
            temperature=0, # Strict JSON mode
            max_tokens=8192,
        ).with_structured_output(model_schema)

        messages = [SystemMessage(content=system), HumanMessage(content=user)]
        return await llm.ainvoke(messages)