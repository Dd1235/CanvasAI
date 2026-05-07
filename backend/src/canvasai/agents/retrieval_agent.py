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
        "You are a factual grounding engine for a visual tutoring system. "
        "Your objective is to extract core mechanics, step-by-step processes, "
        "and specific analogies or examples relevant to the user's prompt.\n\n"
        "RULES:\n"
        "1. Return ONLY the extracted facts, processes, and examples.\n"
        "2. Do not write conversational text.\n"
        "3. If a clear example is found in the source, highlight it explicitly for the synthesizer."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        prompt = state.get("prompt", "")
        
        # 1. Capture the LLM's generated facts into a variable
        extracted_facts = await self.llm.complete(
            system=self.system_prompt, 
            user=prompt,
            model="gemini-2.5-flash-lite" # Keep this fast
        )
        
        # 2. Pass the ACTUAL text down the pipeline, not an empty list
        return {
            "retrieved_context": extracted_facts,
            "trace": self._trace(state, "Generated factual grounding context"),
        }
