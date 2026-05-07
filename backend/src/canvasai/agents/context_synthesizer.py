from __future__ import annotations

from typing import Any

from canvasai.agents.base import AgentBase


class ContextSynthesizer(AgentBase):
    role = "agent_1_synthesizer"
    system_prompt = (
        "You are a technical context analyzer and pedagogical strategist. "
        "Analyze the user's prompt, chat history, and the provided RETRIEVED_FACTS "
        "to determine the true intent and instructional strategy.\n\n"
        "RULES:\n"
        "1. GROUNDING IN FACT: You MUST base your instructional directive on the RETRIEVED_FACTS. "
        "If the facts include a specific example or analogy, you MUST mandate its use in the visual representation.\n"
        "2. CONTEXT AWARENESS: Resolve pronouns (e.g., 'move it') using chat history.\n"
        "3. OUTPUT: Output ONLY a clear, technical directive instructing the Visual Architect on what core concept and example to visualize. Do not design the nodes yourself."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        prompt = state.get("prompt", "")
        history = state.get("chat_history") or []
        nodes = state.get("nodes") or []
        
        # Format the history for the LLM
        history_str = "\n".join([f"{h['role']}: {h['content']}" for h in history[-5:]])
        
        # Inside your ContextSynthesizer's __call__ method:
        retrieved_context = state.get("retrieved_context", "No external context provided.") # Make sure the key matches your state.py

        user_input = (
            f"RETRIEVED_FACTS:\n{retrieved_context}\n\n"
            f"CHAT_HISTORY:\n{history_str}\n\n"
            f"LATEST_USER_PROMPT: {prompt}\n\n"
            f"CURRENT_CANVAS_STATE: {len(nodes)} nodes exist."
        )

        # Optimization: Use the CHEAP model for context synthesis
        directive = await self.llm.complete(
            system=self.system_prompt, 
            user=user_input,
            model="gemini-2.5-flash-lite" 
        )

        return {
            "technical_directive": directive,
            "trace": self._trace(state, "Synthesized intent from history"),
        }