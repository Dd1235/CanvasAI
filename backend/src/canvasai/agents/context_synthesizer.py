"""Agent 1 — Context Synthesizer.

Reads the user's prompt against the current canvas state (nodes + edges) and
emits a precise technical directive for the architect.
"""

from __future__ import annotations

from typing import Any

from canvasai.agents.base import AgentBase


class ContextSynthesizer(AgentBase):
    role = "agent_1_synthesizer"
    system_prompt = (
        "You translate vague user intent into a precise technical directive, "
        "informed by the current canvas state and any retrieved context."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        prompt = state.get("prompt", "")
        nodes = state.get("nodes") or []
        edges = state.get("edges") or []
        ctx = state.get("retrieved_context") or []
        user = (
            f"PROMPT: {prompt}\n"
            f"CANVAS_NODES: {len(nodes)}\n"
            f"CANVAS_EDGES: {len(edges)}\n"
            f"CONTEXT_CHUNKS: {len(ctx)}"
        )
        directive = await self.llm.complete(system=self.system_prompt, user=user)
        return {
            "technical_directive": directive,
            "trace": self._trace(state, "produced technical directive"),
        }
