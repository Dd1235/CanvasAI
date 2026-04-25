"""Persistent WebSocket per canvas session.

Client message:
    {"prompt": "What happens if I insert a duplicate value?",
     "nodes": [...], "edges": [...]}

Server frames (one per agent + one final):
    {"type": "status", "agent": "agent_0_retrieval", "message": "..."}
    ...
    {"type": "payload", "nodes": [...], "edges": [...]}
"""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from canvasai.graph.builder import build_graph
from canvasai.storage import sessions as session_store

router = APIRouter(tags=["ws"])
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
            async for chunk in _graph.astream(initial):
                # chunk is {node_name: state_delta}
                for node_name, delta in chunk.items():
                    final_state.update(delta)
                    trace = final_state.get("trace") or []
                    for entry in trace[seen:]:
                        await ws.send_json({"type": "status", **entry})
                    seen = len(trace)
                    _ = node_name

            payload = final_state.get("output_payload") or {"nodes": [], "edges": []}
            session_store.append_turn(session_id, initial["prompt"], payload)
            await ws.send_json({"type": "payload", **payload})
    except WebSocketDisconnect:
        return
