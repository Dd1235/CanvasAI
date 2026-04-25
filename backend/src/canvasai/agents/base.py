"""Base class for CanvasAI agents.

Each agent is a callable taking the LangGraph state and returning a state
delta (dict). Agents are intentionally thin — domain logic lives in the
agent's prompt + LLM provider, not the class.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from canvasai.llm.provider import LLMProvider, get_provider


class AgentBase(ABC):
    role: str
    system_prompt: str

    def __init__(self, llm: LLMProvider | None = None) -> None:
        self.llm = llm or get_provider()

    @abstractmethod
    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        """Run the agent. Return a partial state to merge."""

    def _trace(self, state: dict[str, Any], message: str) -> list[dict[str, Any]]:
        existing = list(state.get("trace") or [])
        existing.append({"agent": self.role, "message": message})
        return existing
