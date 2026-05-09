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
            # 1. Safely attempt to receive text
            try:
                raw = await ws.receive_text()
            except (WebSocketDisconnect, RuntimeError):
                logger.info(f"Client disconnected from session {session_id}")
                break # Safely exit the loop if socket is dead

            # 2. Parse the JSON
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "invalid json"})
                continue

            # --- Fetch Chat History from the Database ---
            try:
                past_turns = session_store.history(user_id, session_id)
                chat_history = []
                for turn in past_turns[-5:]: # Last 5 turns for context
                    # 1. User's prompt
                    chat_history.append({"role": "user", "content": turn.prompt})
                    # 2. AI's response (cure the amnesia)
                    payload_dict = turn.payload if isinstance(turn.payload, dict) else turn.payload.model_dump()
                    ai_text = payload_dict.get("ai_response", "I updated the canvas.")
                    chat_history.append({"role": "assistant", "content": ai_text})
            except Exception as e:
                logger.error(f"Failed to fetch history for session {session_id}: {e}")
                chat_history = []

            # --- Inject chat_history into the LangGraph state ---
            initial = {
                "prompt": str(msg.get("prompt", "")),
                "chat_history": chat_history,
                "nodes": list(msg.get("nodes") or []),
                "edges": list(msg.get("edges") or []),
                "trace": [],
            }

            final_state: dict = {}
            seen = 0
            
            try:
                async for chunk in _graph.astream(initial):
                    if ws.client_state.value != 1: # 1 is CONNECTED
                        break
                        
                    for _node_name, delta in chunk.items():
                        final_state.update(delta)
                        trace = final_state.get("trace") or []
                        for entry in trace[seen:]:
                            if ws.client_state.value == 1:
                                await ws.send_json({"type": "status", **entry})
                        seen = len(trace)
            except Exception as exc:
                # 1. Catch the specific timeout/disconnect exceptions
                if type(exc).__name__ in ("GeneratorExit", "CancelledError"):
                    logger.info(f"Session {session_id} generation cancelled (Client disconnected or timed out)")
                    break
                
                # 2. Log actual errors with more detail
                logger.error(f"Pipeline Error: {type(exc).__name__} - {str(exc)}")
                try:
                    if ws.client_state.value == 1:
                        await ws.send_json({"type": "error", "message": "Model busy or generation failed."})
                except RuntimeError:
                    pass
                continue

            # --- Save to Database & Send Payload ---
            payload = final_state.get("output_payload") or {"nodes": [], "edges": []}
            try:
                session_store.append_turn(user_id, session_id, initial["prompt"], payload)
            except Exception: 
                logger.exception("session_store.append_turn failed for %s", session_id)
                
            try:
                if ws.client_state.value == 1:
                    await ws.send_json({"type": "payload", **payload})
            except RuntimeError:
                break # Connection died while sending payload
            
    except WebSocketDisconnect:
        pass # Normal disconnect route