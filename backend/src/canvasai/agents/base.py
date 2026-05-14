"""Base class for CanvasAI agents."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from canvasai.llm.provider import LLMProvider, get_provider

# --- CENTRAL ROUTING CONFIGURATION ---
# Change this SINGLE variable to switch engines across all 4 agents instantly.
ACTIVE_ENGINE = "gemini"  # Options: "openai" or "gemini"

MODEL_REGISTRY = {
    "gemini": {
        "fast": "gemini-3.1-flash-lite",
        "heavy": "gemini-3-flash-preview"
    },
    "openai": {
        "fast": "gpt-4o-mini",
        "heavy": "gpt-4o"
    }
}

class AgentBase(ABC):
    role: str
    system_prompt: str
    # Agents declare their intelligence requirement here
    model_tier: str = "fast" 

    def __init__(self, llm: LLMProvider | None = None) -> None:
        self.llm = llm or get_provider()
        # Dynamically grabs the correct model string based on the active engine!
        self.model_name = MODEL_REGISTRY[ACTIVE_ENGINE][self.model_tier]

    @abstractmethod
    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        """Run the agent. Return a partial state to merge."""

    def _trace(self, state: dict[str, Any], message: str) -> list[dict[str, Any]]:
        existing = list(state.get("trace") or [])
        existing.append({"agent": self.role, "message": message})
        return existing