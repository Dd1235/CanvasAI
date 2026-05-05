"""Persistent WebSocket per canvas session."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from canvasai.graph.builder import build_graph
from canvasai.storage import sessions as session_store
from canvasai.storage.client import get_supabase

router = APIRouter(tags=["ws"])
logger = logging.getLogger(__name__)
_graph = build_graph()


@router.websocket("/ws/sessions/{session_id}")
async def session_socket(ws: WebSocket, session_id: str, token: str | None = Query(default=None)) -> None:
    # 1. Official Supabase WebSocket Authentication
    user_id = None
    
    if not token:
        await ws.close(code=1008, reason="Missing token")
        return

    try:
        db = get_supabase()
        user_response = db.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise ValueError("Invalid user session")
            
        user_id = user_response.user.id
    except Exception as e:
        logger.error(f"WebSocket Auth Failed: {str(e)}")
        await ws.close(code=1008, reason="Invalid token")
        return

    # Accept connection if token is valid
    await ws.accept()
    
    try:
        while True:
            raw = await ws.receive_text()
            # ... [The rest of your while loop stays exactly the same!] ...
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
                # Store the turn using the authenticated user_id
                session_store.append_turn(user_id, session_id, initial["prompt"], payload)
            except Exception:  # noqa: BLE001
                logger.exception("session_store.append_turn failed for %s", session_id)
                
            await ws.send_json({"type": "payload", **payload})
            
    except WebSocketDisconnect:
        return