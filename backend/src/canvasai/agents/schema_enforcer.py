import json
from typing import Any
from canvasai.agents.base import AgentBase
from canvasai.schemas import CanvasPayload

class SchemaEnforcer(AgentBase):
    role = "agent_3_enforcer"
    model_tier = "heavy"
    system_prompt = (
        "You are a React Flow Schema Compiler. You convert 'visual_script' into valid JSON.\n\n"
        "### SCHEMA & PERSISTENCE RULES:\n"
        "1. ID RETENTION: You MUST reuse existing IDs from the 'CURRENT_STATE' for nodes/edges that persist.\n"
        "2. ALLOWED EDGE TYPES ONLY: Edge 'type' MUST ONLY be 'default', 'straight', 'step', or 'smoothstep'. NEVER use custom words like 'Triggers'. Use the edge 'label' for that.\n"
        "3. STRICT SCHEMA: Output only valid JSON matching the exact required schema.\n\n"
        
        "### SPATIAL & LAYOUT DESIGN (GRID 2026)\n"
        "1. LESSON_PLAN NODES: Always place at X: -400, Y: 0. This acts as a fixed sidebar. "
        "   Ensure its data matches: { 'steps': [...], 'active_step': int }.\n"
        "2. CODE_STEPPER NODES: These are massive (500px wide). Place them at Y: 0, X: 0. "
        "   Move all other supporting nodes (memory_blocks) to Y: 450 or below to avoid overlap.\n"
        "3. ID PERSISTENCE: If a node exists in CURRENT_STATE and is mentioned in the script, YOU MUST USE THE SAME ID.\n"
        "4. ALIGNMENT: Stack 'memory_block' nodes vertically (Y += 150) if they represent an array or stack.\n\n"
        "5. BOUNDING BOXES: If describing a 'Container' or 'Group', ensure all child nodes have coordinates logically contained within that group's area."
  
        "### DATA INTEGRITY\n"
        "- Ensure 'code_stepper' data includes the 'frames' array exactly as intended by the Architect.\n"
        "- The 'ai_response' field in the final payload MUST contain the full 'AI_CHAT_RESPONSE'."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        visual_script = state.get("visual_script", "")
        ai_response = state.get("ai_response_draft", "Canvas updated.")
        current_state = {"nodes": state.get("nodes", []), "edges": state.get("edges", [])}
        
        # We also pass the lesson plan info here so the Enforcer can 
        # keep the 'LessonPlanNode' updated if it's already on screen.
        lesson_plan_info = {
            "plan": state.get("lesson_plan", []),
            "current_step": state.get("current_step_index", 0)
        }

        user_input = (
            f"AI_CHAT_RESPONSE: {ai_response}\n\n"
            f"VISUAL_SCRIPT: {visual_script}\n\n"
            f"LESSON_PLAN_INFO: {json.dumps(lesson_plan_info)}\n\n"
            f"CURRENT_STATE: {json.dumps(current_state)}"
        )

        payload: CanvasPayload = await self.llm.structured_complete(
            model_schema=CanvasPayload,
            system=self.system_prompt,
            user=user_input,
            model=self.model_name
        )

        return {
            "output_payload": payload.model_dump(),
            "trace": self._trace(state, "Compiled final React Flow payload"),
        }