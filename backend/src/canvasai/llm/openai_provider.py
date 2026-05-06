"""OpenAI provider using LangChain library objects."""
from __future__ import annotations
import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from canvasai.config import get_settings

logger = logging.getLogger(__name__)

class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        self._settings = get_settings()

    async def complete(self, *, system: str, user: str, model: str | None = None) -> str:
        api_key = self._settings.openai_api_key
        target_model = model or self._settings.openai_model
        
        if not api_key:
            return f"[Stub: No API Key] sys={system[:20]} user={user[:20]}"

        try:
            # Initialize the LangChain Chat Object
            llm = ChatOpenAI(
                api_key=api_key,
                model=target_model,
                temperature=0.2,
                timeout=45,
                max_retries=2
            )

            messages = [
                SystemMessage(content=system),
                HumanMessage(content=user),
            ]

            # LangChain handles the async call and parsing
            response = await llm.ainvoke(messages)
            return str(response.content).strip()

        except Exception as e:
            logger.error(f"LangChain OpenAI Error: {str(e)}")
            return f"[Error: {type(e).__name__}] {str(system[:20])}"
        
    async def structured_complete(
        self, *, model_schema: Type[T], system: str, user: str, model: str | None = None
    ) -> T:
        api_key = self._settings.openai_api_key
        target_model = model or self._settings.openai_model
        
        llm = ChatOpenAI(
            api_key=api_key,
            model=target_model,
            temperature=0, # Crucial for schema adherence
        ).with_structured_output(model_schema)

        messages = [
            SystemMessage(content=system),
            HumanMessage(content=user),
        ]
        
        return await llm.ainvoke(messages)