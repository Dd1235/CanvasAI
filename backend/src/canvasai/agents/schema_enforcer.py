from __future__ import annotations
import json
from typing import Any
from canvasai.agents.base import AgentBase
from canvasai.schemas import CanvasPayload

class SchemaEnforcer(AgentBase):
    role = "agent_3_enforcer"
    system_prompt = (
        "You are a React Flow Schema Compiler. Generate the final JSON payload "
        "for a node-and-edge canvas based strictly on the provided Visual Script.\n\n"
        "RULES:\n"
        "1. ID RETENTION: You MUST reuse existing IDs from the 'CURRENT_STATE' for nodes/edges that persist. Only generate new UUIDs for added elements.\n"
        "2. SPATIAL DISTRIBUTION: Assign logical (x,y) coordinates to prevent overlap. Space elements ~250 units apart based on the Architect's grouping logic.\n"
        "3. STATE PRESERVATION: Never delete existing data unless the script explicitly demands removal.\n"
        "4. STRICT SCHEMA: Output only valid JSON matching the exact required schema."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        # Gather inputs from previous agents
        visual_script = state.get("visual_script", "")
        current_nodes = state.get("nodes") or []
        current_edges = state.get("edges") or []

        user_input = (
            f"VISUAL_SCRIPT_PLAN: {visual_script}\n\n"
            f"CURRENT_STATE: {json.dumps({'nodes': current_nodes, 'edges': current_edges})}"
        )

        # Force the LLM to output exactly a CanvasPayload object
        # We use the expensive model (gpt-4o) here for maximum precision
        payload: CanvasPayload = await self.llm.structured_complete(
            model_schema=CanvasPayload,
            system=self.system_prompt,
            user=user_input,
            model="gemini-2.5-flash" 
        )

        # Convert the Pydantic model back to a dict for the LangGraph state
        return {
            "output_payload": payload.model_dump(),
            "trace": self._trace(state, f"Generated schema with {len(payload.nodes)} nodes"),
        }