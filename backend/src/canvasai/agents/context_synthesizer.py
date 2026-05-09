from typing import Any
from canvasai.agents.base import AgentBase

class ContextSynthesizer(AgentBase):
    role = "agent_1_researcher"
    system_prompt = (
        "You are a Knowledge Engine. Based on the User's Intent, find the best factual grounding, "
        "core mechanics, and specific examples/analogies to teach this concept.\n"
        "RULES: Output ONLY the facts and a specific, concrete example (e.g., 'Use a trip planner'). "
        "Do NOT write conversational text."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        intent = state.get("intent_statement", "")
        # Here is where you will eventually wire up your RAG search
        facts = await self.llm.complete(system=self.system_prompt, user=intent, model="gemini-2.5-flash-lite")
        return {
            "retrieved_facts": facts,
            "trace": self._trace(state, "Researched facts and examples"),
        }