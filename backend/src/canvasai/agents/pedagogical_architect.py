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
        "You are a Visual Layout Architect specializing in 'Inside-Out' learning mechanics. "
        "Translate the provided Technical Directive into a precise node-and-edge spatial script.\n\n"
        "RULES:\n"
        "1. NO CONVERSATION: Output ONLY the step-by-step structural logic.\n"
        "2. EXPOSE MECHANICS: Focus on visualizing the low-level state changes, data flows, or structural components of the concept.\n"
        "3. SPATIAL LOGIC: Explicitly state the spatial grouping (e.g., 'Arrange Agent A nodes vertically on the left', 'Use distinct colors for state changes').\n"
        "4. ALIGNMENT: Strictly utilize the technical terms and examples mandated by the Synthesizer."
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
            model="gemini-2.5-flash-lite" # Still using the cheap model for reasoning
        )

        return {
            "visual_script": visual_script,
            "trace": self._trace(state, "Designed visual teaching steps"),
        }