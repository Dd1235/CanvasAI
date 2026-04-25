"""Agent 0 — Retrieval Engine.

Pulls factual context from the vector store (pgvector). Currently stubbed:
returns an empty context list. Wire `canvasai.storage.documents.search()` in
when pgvector is provisioned.
"""

from __future__ import annotations

from typing import Any

from canvasai.agents.base import AgentBase


class RetrievalAgent(AgentBase):
    role = "agent_0_retrieval"
    system_prompt = (
        "You retrieve factual grounding context for a visual tutoring system. "
        "Return only passages directly relevant to the user's prompt."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        prompt = state.get("prompt", "")
        # Stub: no real RAG yet.
        retrieved: list[str] = []
        await self.llm.complete(system=self.system_prompt, user=prompt)
        return {
            "retrieved_context": retrieved,
            "trace": self._trace(state, f"retrieved {len(retrieved)} chunks"),
        }
