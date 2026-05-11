from typing import Any
from canvasai.agents.base import AgentBase

class RetrievalAgent(AgentBase):
    role = "agent_0_intent"
    system_prompt = (
        "You are an Intent Analyzer. Look at the User Prompt and the Chat History. "
        "Figure out EXACTLY what the user wants to learn or modify.\n"
        "RULES: If they say 'move it' or 'add to it', resolve the pronoun using history. "
        "Output ONLY a clear, single-paragraph search query and intent statement."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        prompt = state.get("prompt", "")
        history_str = "\n".join([f"{h['role']}: {h['content']}" for h in state.get("chat_history", [])])
        
        user_input = f"HISTORY:\n{history_str}\n\nLATEST PROMPT: {prompt}"
        
        # UPGRADED TO GPT-4o-MINI
        intent = await self.llm.complete(system=self.system_prompt, user=user_input, model="gpt-4o-mini")
        return {
            "intent_statement": intent,
            "trace": self._trace(state, "Analyzed user intent and context"),
        }