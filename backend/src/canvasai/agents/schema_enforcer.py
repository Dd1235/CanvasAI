"""Agent 3 — Schema Enforcer.

Takes the visual script and emits a strict React Flow JSON payload:
`{"nodes": [...], "edges": [...]}`. This agent never produces free text;
its output is the source of truth shipped to the frontend.

For the skeleton it emits a deterministic 3-node demo graph so the frontend
can render *something* end-to-end. Replace with a real LLM call constrained
by JSON-mode / function calling when the live model is wired in.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from canvasai.agents.base import AgentBase


class SchemaEnforcer(AgentBase):
    role = "agent_3_schema"
    system_prompt = (
        "You output ONLY minified JSON of shape {\"nodes\":[...],\"edges\":[...]} "
        "compatible with React Flow. Reject any conversational tokens."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        model_payload = await self.llm.complete(
            system=self.system_prompt,
            user=json.dumps(
                {
                    "prompt": state.get("prompt", ""),
                    "current_nodes": state.get("nodes") or [],
                    "current_edges": state.get("edges") or [],
                    "visual_script": state.get("visual_script", ""),
                },
                default=str,
            ),
        )
        payload = _parse_payload(model_payload)
        if payload:
            return {
                "output_payload": payload,
                "trace": self._trace(state, f"emitted {len(payload['nodes'])} model nodes"),
            }

        prompt = state.get("prompt", "demo")
        root = str(uuid.uuid4())
        left = str(uuid.uuid4())
        right = str(uuid.uuid4())

        payload: dict[str, list[dict[str, Any]]] = {
            "nodes": [
                {
                    "id": root,
                    "type": "default",
                    "position": {"x": 0, "y": 0},
                    "data": {"label": prompt[:32] or "root"},
                },
                {
                    "id": left,
                    "type": "default",
                    "position": {"x": -160, "y": 120},
                    "data": {"label": "left"},
                },
                {
                    "id": right,
                    "type": "default",
                    "position": {"x": 160, "y": 120},
                    "data": {"label": "right"},
                },
            ],
            "edges": [
                {"id": f"{root}-{left}", "source": root, "target": left},
                {"id": f"{root}-{right}", "source": root, "target": right},
            ],
        }
        return {
            "output_payload": payload,
            "trace": self._trace(state, f"emitted {len(payload['nodes'])} nodes"),
        }


def _parse_payload(raw: str) -> dict[str, list[dict[str, Any]]] | None:
    try:
        data = json.loads(_extract_json(raw))
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(data, dict):
        return None
    nodes = data.get("nodes")
    edges = data.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return None
    if not all(isinstance(node, dict) for node in nodes):
        return None
    if not all(isinstance(edge, dict) for edge in edges):
        return None
    if not all({"id", "position", "data"}.issubset(node) for node in nodes):
        return None
    if not all({"id", "source", "target"}.issubset(edge) for edge in edges):
        return None

    return {"nodes": nodes, "edges": edges}


def _extract_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = "\n".join(line for line in text.splitlines() if not line.strip().startswith("```")).strip()

    starts = [index for index in (text.find("{"), text.find("[")) if index >= 0]
    if not starts:
        return text
    start = min(starts)
    end = text.rfind("}" if text[start] == "{" else "]")
    return text[start : end + 1] if end >= start else text[start:]
