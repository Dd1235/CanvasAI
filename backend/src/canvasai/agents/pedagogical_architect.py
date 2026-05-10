from typing import Any
from pydantic import BaseModel
from canvasai.agents.base import AgentBase

# We use structured output here to split the conversational response from the technical script
class ArchitectOutput(BaseModel):
    ai_chat_response: str
    visual_script: str

class PedagogicalArchitect(AgentBase):
    role = "agent_2_architect"
    system_prompt = (
        "You are a Visual Tutor. You have two jobs based on the Facts and Intent:\n"
        "1. Write a friendly, 1-2 sentence 'ai_chat_response' addressing the user and explaining the analogy/example you chose.\n"
        "2. Write a precise 'visual_script' instructing the UI how to draw nodes/edges. Focus on 'Inside-Out' mechanics."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        intent = state.get("intent_statement", "")
        facts = state.get("retrieved_facts", "")
        nodes_len = len(state.get("nodes", []))
        
        user_input = f"INTENT: {intent}\n\nFACTS: {facts}\n\nCURRENT NODES: {nodes_len}"
        
        output: ArchitectOutput = await self.llm.structured_complete(
            model_schema=ArchitectOutput,
            system=self.system_prompt,
            user=user_input,
            model="gemini-2.5-flash" 
        )

        return {
            "ai_response_draft": output.ai_chat_response,
            "visual_script": output.visual_script,
            "trace": self._trace(state, "Designed visual layout and drafted response"),
        }