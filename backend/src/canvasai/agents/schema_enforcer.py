from __future__ import annotations
import json
from typing import Any
from canvasai.agents.base import AgentBase
from canvasai.schemas import CanvasPayload

class SchemaEnforcer(AgentBase):
    role = "agent_3_enforcer" # Updated role
    system_prompt = (
        "You are a React Flow Schema Architect. Your job is to generate the final "
        "JSON payload for a node-and-edge canvas based on a Visual Script.\n\n"
        "RULES:\n"
        "1. REUSE IDs: If a node or edge already exists in the 'CURRENT_STATE', "
        "use its existing ID. Only generate new UUIDs for truly new elements.\n"
        "2. SPATIAL REASONING: Ensure nodes are spaced out logically (usually 200-300 units apart).\n"
        "3. CONSISTENCY: Do not lose existing data unless the script explicitly says to delete it."
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