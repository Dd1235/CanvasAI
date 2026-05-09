import json
from typing import Any
from canvasai.agents.base import AgentBase
from canvasai.schemas import CanvasPayload

class SchemaEnforcer(AgentBase):
    role = "agent_3_enforcer"
    system_prompt = (
        "You are a React Flow Schema Compiler. Generate the JSON payload strictly following the Visual Script.\n\n"
        "RULES:\n"
        "1. ID RETENTION: Reuse existing IDs for nodes/edges that persist.\n"
        "2. INJECT RESPONSE: Copy the provided AI_CHAT_RESPONSE exactly into the 'ai_response' field.\n"
        "3. ALLOWED EDGE TYPES ONLY: Edge 'type' MUST ONLY be 'default', 'straight', 'step', or 'smoothstep'. NEVER use custom words like 'Triggers'. Use the edge 'label' for that.\n"
        "4. SPACING: Assign logical (x,y) coordinates to prevent overlap (~250 units apart).\n"
        "5. STRICT SCHEMA: Output only valid JSON."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        visual_script = state.get("visual_script", "")
        ai_response = state.get("ai_response_draft", "Canvas updated.")
        
        user_input = (
            f"AI_CHAT_RESPONSE: {ai_response}\n\n"
            f"VISUAL_SCRIPT: {visual_script}\n\n"
            f"CURRENT_STATE: {json.dumps({'nodes': state.get('nodes', []), 'edges': state.get('edges', [])})}"
        )

        payload: CanvasPayload = await self.llm.structured_complete(
            model_schema=CanvasPayload,
            system=self.system_prompt,
            user=user_input,
            model="gemini-2.5-flash-lite" # Move to lite for speed/quota!
        )

        return {
            "output_payload": payload.model_dump(),
            "trace": self._trace(state, "Compiled strict JSON payload"),
        }