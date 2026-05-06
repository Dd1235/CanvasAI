"""Agent 2 — Pedagogical Architect.

Takes the technical directive and formulates a visual script: an
instructional sequence of canvas mutations (highlight, reroute, animate).
"""

from __future__ import annotations
from typing import Any
from canvasai.agents.base import AgentBase

class PedagogicalArchitect(AgentBase):
    role = "agent_2_architect"
    system_prompt = (
        "You are a Computer Science Professor and Visual Designer. "
        "Your goal is to describe how to change a node-and-edge canvas to teach a concept.\n\n"
        "Guidelines:\n"
        "1. Focus on 'Inside-Out' learning: show the mechanics, not just the result.\n"
        "2. Describe nodes to add, edges to animate, or colors to change.\n"
        "3. Use technical terms from the directive provided by the synthesizer."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        directive = state.get("technical_directive", "")
        # Optional: We could use a slightly more expensive model here if needed
        
        user_input = (
            f"TECHNICAL_DIRECTIVE: {directive}\n"
            f"CURRENT_STRUCTURE: {len(state.get('nodes', []))} nodes, {len(state.get('edges', []))} edges."
        )

        visual_script = await self.llm.complete(
            system=self.system_prompt,
            user=user_input,
            model="gpt-4o-mini" # Still using the cheap model for reasoning
        )

        return {
            "visual_script": visual_script,
            "trace": self._trace(state, "Designed visual teaching steps"),
        }