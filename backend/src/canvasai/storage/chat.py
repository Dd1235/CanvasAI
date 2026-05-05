from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from canvasai.schemas import ChatMessage, ChatSessionSummary
from canvasai.storage.client import get_supabase


def _now() -> datetime:
    return datetime.now(UTC)


def create_session(user_id: str, title: str | None = None) -> dict[str, str]:
    db = get_supabase()
    now = _now().isoformat()
    res = db.table("chat_sessions").insert(
        {
            "user_id": user_id,
            "title": title or "Learning chat",
            "created_at": now,
            "updated_at": now,
        }
    ).execute()
    data = res.data[0]
    return {"id": data["id"], "title": data["title"]}


def list_sessions(user_id: str) -> list[ChatSessionSummary]:
    db = get_supabase()
    sessions_res = (
        db.table("chat_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )

    summaries = []
    for s in sessions_res.data:
        count_res = (
            db.table("chat_messages")
            .select("id", count="exact")
            .eq("session_id", s["id"])
            .execute()
        )
        summaries.append(
            ChatSessionSummary(
                id=s["id"],
                title=s["title"],
                created_at=datetime.fromisoformat(s["created_at"]),
                updated_at=datetime.fromisoformat(s["updated_at"]),
                message_count=count_res.count or 0,
            )
        )
    return summaries


def messages(user_id: str, session_id: str) -> list[ChatMessage]:
    db = get_supabase()
    session_res = (
        db.table("chat_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not session_res.data:
        return []

    msgs_res = (
        db.table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    return [
        ChatMessage(
            role=m["role"],
            content=m["content"],
            created_at=datetime.fromisoformat(m["created_at"]),
        )
        for m in msgs_res.data
    ]


def add_message(
    user_id: str, session_id: str, role: Literal["user", "assistant", "system"], content: str
) -> ChatMessage:
    db = get_supabase()
    
    session_res = db.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not session_res.data:
        raise ValueError("Session not found or access denied")

    now = _now()
    
    # 1. Insert the message
    msg_res = db.table("chat_messages").insert(
        {"session_id": session_id, "role": role, "content": content}
    ).execute()

    # 2. Update the session timestamp (Title remains untouched)
    db.table("chat_sessions").update({
        "updated_at": now.isoformat()
    }).eq("id", session_id).execute()

    m = msg_res.data[0]
    return ChatMessage(
        role=m["role"],
        content=m["content"],
        created_at=datetime.fromisoformat(m["created_at"]),
    )