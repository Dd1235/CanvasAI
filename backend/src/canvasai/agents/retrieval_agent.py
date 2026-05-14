from typing import Any
from canvasai.agents.base import AgentBase

class RetrievalAgent(AgentBase):
    role = "agent_0_intent"
    model_tier = "fast"
    system_prompt = (
        "You are an Intent Analyzer for an AI Tutor. Analyze the prompt and history.\n\n"
        "### ROUTING RULES\n"
        "1. BROAD TOPIC: If the user wants to learn a concept from scratch (e.g., 'What is X?', 'Explain Y'), "
        "output: [PLAN_REQUIRED] followed by a search query.\n"
        "2. SPECIFIC ACTION: If the user wants to modify an existing node or has a specific code bug, "
        "output: [DIRECT_ACTION] followed by the intent.\n\n"
        "### 'INSIDE-OUT' CONTEXT\n"
        "If the topic is high-level (like 'Topological Sort'), ensure the intent includes finding "
        "low-level prerequisites (like 'Directed Acyclic Graphs' or 'Array-based adjacency lists')."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        prompt = state.get("prompt", "")
        history_str = "\n".join([f"{h['role']}: {h['content']}" for h in state.get("chat_history", [])])
        
        user_input = f"HISTORY:\n{history_str}\n\nLATEST PROMPT: {prompt}"
        intent = await self.llm.complete(system=self.system_prompt, user=user_input, model=self.model_name)
        
        return {
            "intent_statement": intent,
            "trace": self._trace(state, f"Routed intent: {intent[:50]}..."),
        }