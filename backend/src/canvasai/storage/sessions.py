from __future__ import annotations
import uuid
from typing import Any
from datetime import UTC, datetime

from canvasai.schemas import CanvasPayload, SessionDetail, SessionSummary, SessionTurn
from canvasai.storage.client import get_supabase

def _now() -> datetime:
    return datetime.now(UTC)

def create_session(user_id: str, title: str | None = None) -> dict[str, str]:
    db = get_supabase()
    session_title = title or "Untitled canvas session"
    
    response = db.table("canvas_sessions").insert({
        "user_id": user_id,
        "title": session_title
    }).execute()
    
    data = response.data[0]
    return {"id": data["id"], "title": data["title"]}

def ensure_session(user_id: str, session_id: str, title: str | None = None) -> None:
    db = get_supabase()
    # Check if exists and belongs to user
    existing = db.table("canvas_sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    
    if not existing.data:
        # If it doesn't exist (e.g., local fallback), create it with the prompt as a fallback title
        db.table("canvas_sessions").insert({
            "id": session_id,
            "user_id": user_id,
            "title": title or session_id
        }).execute()
    else:
        # It exists! ONLY update the timestamp. Do NOT overwrite the title.
        db.table("canvas_sessions").update({
            "updated_at": _now().isoformat()
        }).eq("id", session_id).execute()

def list_sessions(user_id: str) -> list[SessionSummary]:
    db = get_supabase()
    
    # In a real production app with heavy load, you would use a SQL View or RPC to join the turn count and last prompt.
    # For the hackathon, fetching sessions and mapping is acceptable.
    sessions_res = db.table("canvas_sessions").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
    
    summaries = []
    for s in sessions_res.data:
        # Fetch just the last turn for the summary
        last_turn_res = db.table("canvas_turns").select("prompt").eq("session_id", s["id"]).order("turn_index", desc=True).limit(1).execute()
        turn_count_res = db.table("canvas_turns").select("id", count="exact").eq("session_id", s["id"]).execute()
        
        summaries.append(SessionSummary(
            id=s["id"],
            title=s["title"],
            created_at=datetime.fromisoformat(s["created_at"]),
            updated_at=datetime.fromisoformat(s["updated_at"]),
            turn_count=turn_count_res.count or 0,
            last_prompt=last_turn_res.data[0]["prompt"] if last_turn_res.data else None,
            neuro_profile=s.get("neuro_profile", "Spatial"),
        ))
    return summaries

def get_session(user_id: str, session_id: str) -> SessionDetail | None:
    db = get_supabase()
    session_res = db.table("canvas_sessions").select("*").eq("id", session_id).eq("user_id", user_id).execute()
    
    if not session_res.data:
        return None
        
    session_data = session_res.data[0]
    turns = history(user_id, session_id)
    
    return SessionDetail(
        id=session_data["id"],
        title=session_data["title"],
        created_at=datetime.fromisoformat(session_data["created_at"]),
        updated_at=datetime.fromisoformat(session_data["updated_at"]),
        turn_count=len(turns),
        last_prompt=turns[-1].prompt if turns else None,
        turns=turns,
        neuro_profile=session_data.get("neuro_profile", "Spatial"),
    )

def append_turn(user_id: str, session_id: str, prompt: str, payload: dict[str, Any]) -> int:
    ensure_session(user_id, session_id, title=prompt[:48] or session_id)
    db = get_supabase()
    
    # Get current max turn index
    turns_res = db.table("canvas_turns").select("turn_index").eq("session_id", session_id).order("turn_index", desc=True).limit(1).execute()
    next_index = (turns_res.data[0]["turn_index"] + 1) if turns_res.data else 0
    
    db.table("canvas_turns").insert({
        "session_id": session_id,
        "turn_index": next_index,
        "prompt": prompt,
        "payload": payload
    }).execute()
    
    db.table("canvas_sessions").update({"updated_at": _now().isoformat()}).eq("id", session_id).execute()
    return next_index

def history(user_id: str, session_id: str) -> list[SessionTurn]:
    db = get_supabase()
    # Verify ownership first
    session_res = db.table("canvas_sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not session_res.data:
        return []

    turns_res = db.table("canvas_turns").select("*").eq("session_id", session_id).order("turn_index").execute()
    
    return [
        SessionTurn(
            prompt=t["prompt"],
            payload=CanvasPayload.model_validate(t["payload"]),
            turn_index=t["turn_index"],
            created_at=datetime.fromisoformat(t["created_at"]),
            is_checkpoint=t.get("is_checkpoint", False) # NEW
        ) for t in turns_res.data
    ]

def revert_to(user_id: str, session_id: str, turn_index: int) -> SessionTurn | None:
    db = get_supabase()
    session_res = db.table("canvas_sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not session_res.data:
        return None

    # Hard delete all turns strictly greater than the target index
    db.table("canvas_turns").delete().eq("session_id", session_id).gt("turn_index", turn_index).execute()
    db.table("canvas_sessions").update({"updated_at": _now().isoformat()}).eq("id", session_id).execute()
    
    turns = history(user_id, session_id)
    return turns[-1] if turns else None

def set_checkpoint(user_id: str, session_id: str, turn_index: int, is_checkpoint: bool) -> None:
    db = get_supabase()
    # Verify ownership
    session_res = db.table("canvas_sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not session_res.data:
        raise ValueError("Session not found")
        
    db.table("canvas_turns").update({"is_checkpoint": is_checkpoint}).eq("session_id", session_id).eq("turn_index", turn_index).execute()

def branch_session(user_id: str, session_id: str, turn_index: int) -> dict[str, str]:
    db = get_supabase()
    orig = db.table("canvas_sessions").select("*").eq("id", session_id).eq("user_id", user_id).execute()
    if not orig.data:
        raise ValueError("Session not found")
        
    # 1. Create the new session
    new_id = str(uuid.uuid4())
    new_title = f"{orig.data[0]['title']} (Branch)"
    db.table("canvas_sessions").insert({
        "id": new_id, 
        "user_id": user_id, 
        "title": new_title
    }).execute()
    
    # 2. Fetch all turns up to the checkpoint
    turns = db.table("canvas_turns").select("*").eq("session_id", session_id).lte("turn_index", turn_index).execute()
    
    # 3. Duplicate them into the new session
    new_turns = []
    for t in turns.data:
        # We delete the primary key and created_at so Supabase generates new ones natively
        if "id" in t: del t["id"]
        if "created_at" in t: del t["created_at"]
        t["session_id"] = new_id
        new_turns.append(t)
        
    if new_turns:
        db.table("canvas_turns").insert(new_turns).execute()
        
    return {"id": new_id, "title": new_title}

# New function to update the profile
def update_neuro_profile(user_id: str, session_id: str, profile: str) -> None:
    db = get_supabase()
    # Verify ownership and update in one query
    db.table("canvas_sessions").update({
        "neuro_profile": profile,
        "updated_at": _now().isoformat()
    }).eq("id", session_id).eq("user_id", user_id).execute()