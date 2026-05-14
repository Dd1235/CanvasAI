"""LLM provider injection seam.

To add a provider:
  1. Implement `LLMProvider` in a new module under `canvasai.llm`.
  2. Register it in `_REGISTRY` below.
  3. Set `LLM_PROVIDER=<name>` in `.env`.

Agents call `get_provider().complete(...)` — they never import a concrete
provider directly.
"""

from __future__ import annotations
from typing import Protocol, Any
from canvasai.config import get_settings

from typing import Protocol, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class LLMProvider(Protocol):
    name: str
    
    async def complete(self, *, system: str, user: str, model: str | None = None) -> str:
        """Standard string completion."""

    async def structured_complete(
        self, *, model_schema: Type[T], system: str, user: str, model: str | None = None
    ) -> T:
        """Completion that returns a validated Pydantic model."""

def get_provider() -> LLMProvider:
    from canvasai.llm.openai_provider import OpenAIProvider
    from canvasai.llm.gemini_provider import GeminiProvider # ADD THIS

    _REGISTRY: dict[str, type[LLMProvider]] = {
        "openai": OpenAIProvider,
        "gemini": GeminiProvider, # ADD THIS
    }

    name = get_settings().llm_provider
    impl = _REGISTRY.get(name)
    if impl is None:
        raise ValueError(f"Unknown LLM provider: {name!r}. Registered: {list(_REGISTRY)}")
    return impl()