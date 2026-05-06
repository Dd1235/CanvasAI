from __future__ import annotations

from typing import Any

from canvasai.agents.base import AgentBase


class ContextSynthesizer(AgentBase):
    role = "agent_1_synthesizer"
    system_prompt = (
        "You are a technical context analyzer. Your job is to read the user's latest prompt "
        "and their previous chat history to determine their TRUE intent.\n\n"
        "If the user says 'move it', check the history to see what 'it' refers to.\n"
        "Output a clear, technical directive for a visual architect."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        prompt = state.get("prompt", "")
        history = state.get("chat_history") or []
        nodes = state.get("nodes") or []
        
        # Format the history for the LLM
        history_str = "\n".join([f"{h['role']}: {h['content']}" for h in history[-5:]])

        user_input = (
            f"CHAT_HISTORY:\n{history_str}\n\n"
            f"LATEST_USER_PROMPT: {prompt}\n\n"
            f"CURRENT_CANVAS_STATE: {len(nodes)} nodes exist."
        )

        # Optimization: Use the CHEAP model for context synthesis
        directive = await self.llm.complete(
            system=self.system_prompt, 
            user=user_input,
            model="gpt-4o-mini" 
        )

        return {
            "technical_directive": directive,
            "trace": self._trace(state, "Synthesized intent from history"),
        }