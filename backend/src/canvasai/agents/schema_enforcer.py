import json
from typing import Any
from canvasai.agents.base import AgentBase
from canvasai.schemas import CanvasPayload

class SchemaEnforcer(AgentBase):
    role = "agent_3_enforcer"
    model_tier = "heavy"
    system_prompt = (
        "You are a React Flow Schema Compiler. You convert 'visual_script' into valid JSON.\n\n"
        "### SCHEMA & PERSISTENCE RULES (CRITICAL):\n"
        "1. DEFAULT TO PERSISTENCE (MERGE, DO NOT OVERWRITE): You are modifying a live canvas. Unless the VISUAL_SCRIPT explicitly uses the word 'DELETE' for a specific node ID, or 'CLEAR' for the board, YOU MUST COPY EVERY SINGLE EXISTING NODE AND EDGE from the CURRENT_STATE into your final output payload.\n"
        "2. ID RETENTION & MUTATION: \n"
        "   - UPDATE: Find the node in CURRENT_STATE, keep its exact X/Y coordinates, and modify its data.\n"
        "   - ADD: Append to the list AND explicitly calculate safe `position` (X, Y) coordinates to prevent overlapping with existing nodes in the CURRENT_STATE.\n"
        "   - DELETE: Omit the node from the final list.\n"
        "3. ALLOWED EDGE TYPES ONLY: Edge 'type' MUST ONLY be 'default', 'straight', 'step', or 'smoothstep'.\n"
        "4. STRICT SCHEMA: Output only valid JSON matching the exact required schema.\n\n"
        
        "### SPATIAL & LAYOUT DESIGN (GRID 2026)\n"
        "1. LESSON_PLAN NODES: Always place at X: -400, Y: 0. Ensure its data matches: { 'steps': [...], 'active_step': int }.\n"
        "2. CODE_STEPPER NODES: These are massive (500px wide). Place them at Y: 0, X: 0. Move all other supporting nodes (memory_blocks) to Y: 450 or below to avoid overlap.\n"
        "3. ID PERSISTENCE (UPDATE or NO CHANGE): If a node exists in CURRENT_STATE and is mentioned in the script, YOU MUST USE THE SAME ID.\n"
        "4. DYNAMIC INSERTION (ADD): When adding a new node, look at the max X and Y values of current nodes. Place new nodes at the next logical empty slot (e.g., if appending to a vertical stack, find the highest Y value of that stack and add 150).\n"
        "5. DYNAMIC REARRANGEMENT (DELETE): If a deletion creates a jarring gap in a logical structure (like an array of memory blocks), adjust the X/Y coordinates of the remaining related nodes to close the gap and maintain alignment. Only rearrange if it benefits the visual flow.\n"
        "6. BOUNDING BOXES: If describing a 'Container' or 'Group', ensure all child nodes have coordinates logically contained within that group's area."
        
        "### DATA INTEGRITY\n"
        "- Ensure 'code_stepper' data includes the 'frames' array exactly as intended by the Architect.\n"
        "- Format the 'code' field as an ARRAY OF STRINGS (one string per line of code). Do NOT use '\\n' characters."
        "- The 'ai_response' field in the final payload MUST contain the full 'AI_CHAT_RESPONSE'."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        visual_script = state.get("visual_script", "")
        ai_response = state.get("ai_response_draft", "Canvas updated.")
        current_state = {"nodes": state.get("nodes", []), "edges": state.get("edges", [])}
        user_neuroprofile = state.get("user_neuroprofile", "Spatial") # Fetch profile
        
        lesson_plan_info = {
            "plan": state.get("lesson_plan", []),
            "current_step": state.get("current_step_index", 0)
        }

        # --- NEW: Dynamic Layout Geometry ---
        profile_layout_rules = ""
        if user_neuroprofile == "Low-stim":
            profile_layout_rules = "LOW-STIM PROFILE: Force all new edge 'type' to 'straight' (no animations). Avoid dense clusters. Keep wide padding between nodes."
        elif user_neuroprofile == "Micro-step":
            profile_layout_rules = "MICRO-STEP PROFILE: Center the active node at X: 0, Y: 0. Push all other nodes far to the periphery or delete them if commanded."
        else:
            profile_layout_rules = "SPATIAL PROFILE: Use 'smoothstep' edges with 'animated': true to visually represent data flow. Group related memory_blocks tightly together vertically."

        user_input = (
            f"ACTIVE NEUROPROFILE LAYOUT RULES:\n{profile_layout_rules}\n\n"
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

        # --- THE FOOLPROOF INJECTION ---
        final_payload_dict = payload.model_dump()
        # We aggressively overwrite whatever the Enforcer tried to put here
        # with the exact, perfect draft from the Architect.
        final_payload_dict["ai_response"] = ai_response 

        return {
            "output_payload": final_payload_dict,
            "trace": self._trace(state, "Compiled final React Flow payload"),
        }