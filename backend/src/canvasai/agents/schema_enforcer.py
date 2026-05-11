import json
from typing import Any
from canvasai.agents.base import AgentBase
from canvasai.schemas import CanvasPayload

class SchemaEnforcer(AgentBase):
    role = "agent_3_enforcer"
    model_tier = "heavy"
    system_prompt = (
        "You are a React Flow Schema Compiler. Generate the JSON payload strictly following the Visual Script.\n\n"
        "SCHEMA & PERSISTENCE RULES:\n"
        "1. ID RETENTION: You MUST reuse existing IDs from the 'CURRENT_STATE' for nodes/edges that persist.\n"
        "2. INJECT RESPONSE: Copy the provided AI_CHAT_RESPONSE exactly into the 'ai_response' field.\n"
        "3. ALLOWED EDGE TYPES ONLY: Edge 'type' MUST ONLY be 'default', 'straight', 'step', or 'smoothstep'. NEVER use custom words like 'Triggers'. Use the edge 'label' for that.\n"
        "4. STRICT SCHEMA: Output only valid JSON matching the exact required schema.\n\n"
        "SPATIAL & LAYOUT RULES (CLEAN CANVAS MANDATE):\n"
        "5. WIDE CUSTOM NODES: Pay attention to 'type'. Custom nodes like 'memory_block', 'logic_gate', and 'code_stepper' are WIDE (approx 250px-350px).\n"
        "6. GRID SPACING: To prevent overlapping, space nodes horizontally by AT LEAST X += 350 units, and vertically by Y += 150 units.\n"
        "7. FLOW DIRECTION: Place 'Input' or 'Start' nodes on the left (X=0). Move right (X+=350) for sequence. Stack related items (like arrays of memory blocks) vertically (Y+=150).\n"
        "8. NO COLLISION: No two nodes should ever have the exact same (x, y) coordinates."
        "9. BOUNDING BOXES: If describing a 'Container' or 'Group', ensure all child nodes have coordinates logically contained within that group's area."
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
            model=self.model_name
        )

        return {
            "output_payload": payload.model_dump(),
            "trace": self._trace(state, "Compiled strict JSON payload with clean layout"),
        }