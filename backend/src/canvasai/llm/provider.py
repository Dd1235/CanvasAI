"""LLM provider injection seam.

To add a provider:
  1. Implement `LLMProvider` in a new module under `canvasai.llm`.
  2. Register it in `_REGISTRY` below.
  3. Set `LLM_PROVIDER=<name>` in `.env`.

Agents call `get_provider().complete(...)` — they never import a concrete
provider directly.
"""

from __future__ import annotations

from typing import Protocol

from canvasai.config import get_settings


class LLMProvider(Protocol):
    name: str

    async def complete(self, *, system: str, user: str) -> str:
        """Single-shot completion. Returns model output as a string."""


def get_provider() -> LLMProvider:
    from canvasai.llm.openai_provider import OpenAIProvider

    _REGISTRY: dict[str, type[LLMProvider]] = {
        "openai": OpenAIProvider,
    }

    name = get_settings().llm_provider
    impl = _REGISTRY.get(name)
    if impl is None:
        raise ValueError(f"Unknown LLM provider: {name!r}. Registered: {list(_REGISTRY)}")
    return impl()
