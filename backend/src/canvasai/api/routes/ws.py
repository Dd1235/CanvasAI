"""Persistent WebSocket per canvas session.

Client message:
    {"prompt": "What happens if I insert a duplicate value?",
     "nodes": [...], "edges": [...]}

Server frames (one per agent + one final):
    {"type": "status", "agent": "agent_0_retrieval", "message": "..."}
    ...
    {"type": "payload", "nodes": [...], "edges": [...]}

If the pipeline raises, an `{"type": "error", "message": "..."}` frame is
sent and the loop continues — the connection stays open so the user can
retry without reconnecting.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from canvasai.graph.builder import build_graph
from canvasai.storage import sessions as session_store

router = APIRouter(tags=["ws"])
logger = logging.getLogger(__name__)
_graph = build_graph()


@router.websocket("/ws/sessions/{session_id}")
async def session_socket(ws: WebSocket, session_id: str) -> None:
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "invalid json"})
                continue

            initial = {
                "prompt": str(msg.get("prompt", "")),
                "nodes": list(msg.get("nodes") or []),
                "edges": list(msg.get("edges") or []),
                "trace": [],
            }

            final_state: dict = {}
            seen = 0
            try:
                async for chunk in _graph.astream(initial):
                    for _node_name, delta in chunk.items():
                        final_state.update(delta)
                        trace = final_state.get("trace") or []
                        for entry in trace[seen:]:
                            await ws.send_json({"type": "status", **entry})
                        seen = len(trace)
            except Exception as exc:  # noqa: BLE001
                logger.exception("ws pipeline failed for session %s", session_id)
                await ws.send_json({"type": "error", "message": f"pipeline failed: {exc}"})
                continue

            payload = final_state.get("output_payload") or {"nodes": [], "edges": []}
            try:
                session_store.append_turn(session_id, initial["prompt"], payload)
            except Exception:  # noqa: BLE001
                logger.exception("session_store.append_turn failed for %s", session_id)
            await ws.send_json({"type": "payload", **payload})
    except WebSocketDisconnect:
        return
