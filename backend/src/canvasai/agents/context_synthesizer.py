from typing import Any
from canvasai.agents.base import AgentBase

class ContextSynthesizer(AgentBase):
    role = "agent_1_researcher"
    model_tier = "fast"
    system_prompt = (
        "You are a Factual Research Engine. Your goal is to synthesize a teaching strategy "
        "using the provided EXTERNAL_DOCS and the User's INTENT.\n\n"
        "RULES FOR FALLBACK HIERARCHY:\n"
        "1. PRIORITY 1 (EXPLICIT GROUNDING): If EXTERNAL_DOCS contains valid information, you MUST use "
        "the facts, examples, and terminology strictly from that text. Do not hallucinate outside info.\n"
        "2. PRIORITY 2 (INTERNAL KNOWLEDGE): If EXTERNAL_DOCS is empty or says 'No external documents provided.', "
        "you MUST act as a Subject Matter Expert. Rely on your internal training data to synthesize a "
        "world-class pedagogical analogy or example (focusing on 'Inside-Out' mechanics) based on the INTENT.\n"
        "3. OUTPUT: Provide the core facts and the exact example to be used by the Architect. Do NOT write conversational text."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        intent = state.get("intent_statement", "")
        docs = state.get("external_docs", "No external documents provided.") 
        
        user_input = f"USER_INTENT: {intent}\n\nEXTERNAL_DOCS: {docs}"
        
        facts = await self.llm.complete(system=self.system_prompt, user=user_input, model=self.model_name)
        return {
            "retrieved_facts": facts,
            "trace": self._trace(state, "Synthesized research using fallback hierarchy"),
        }