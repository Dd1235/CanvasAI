from typing import Any
from canvasai.agents.base import AgentBase

class RetrievalAgent(AgentBase):
    role = "agent_0_intent"
    model_tier = "fast"
    system_prompt = (
        "You are an Intent Analyzer for an AI Tutor. Analyze the prompt and history.\n\n"
        "### ROUTING RULES\n"
        "1. NEW BROAD TOPIC: If the user wants to learn a concept from scratch AND the STATUS says 'NO ACTIVE PLAN', "
        "output: [PLAN_REQUIRED] followed by a search query.\n"
        "2. CONTINUE LESSON / SPECIFIC ACTION: If the user is answering a check-in question (e.g., 'yes', 'makes sense', 'next'), "
        "modifying an existing node, OR if the STATUS says 'ACTIVE LESSON PLAN EXISTS', "
        "output: [DIRECT_ACTION] followed by a clear instruction to continue the lesson or perform the action.\n\n"
        "### 'INSIDE-OUT' CONTEXT\n"
        "If the topic is high-level (like 'Topological Sort'), ensure the intent includes finding "
        "low-level prerequisites (like 'Directed Acyclic Graphs' or 'Array-based adjacency lists')."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        prompt = state.get("prompt", "")
        history_str = "\n".join([f"{h['role']}: {h['content']}" for h in state.get("chat_history", [])])
        
        # Check if ws.py extracted a plan from the canvas nodes
        plan = state.get("lesson_plan", [])
        plan_status = "ACTIVE LESSON PLAN EXISTS" if len(plan) > 0 else "NO ACTIVE PLAN"
        
        user_input = (
            f"STATUS: {plan_status}\n\n"
            f"HISTORY:\n{history_str}\n\n"
            f"LATEST PROMPT: {prompt}"
        )
        
        intent = await self.llm.complete(system=self.system_prompt, user=user_input, model=self.model_name)
        
        return {
            "intent_statement": intent,
            "trace": self._trace(state, f"Routed intent: {intent[:50]}..."),
        }