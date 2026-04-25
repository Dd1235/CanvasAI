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
        "You decide how to teach the directive visually. Output a script of "
        "canvas mutations (e.g. 'highlight node X red, then reroute edge to Y')."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        directive = state.get("technical_directive", "")
        script = await self.llm.complete(system=self.system_prompt, user=directive)
        return {
            "visual_script": script,
            "trace": self._trace(state, "produced visual script"),
        }
