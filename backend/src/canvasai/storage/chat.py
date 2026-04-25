from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from canvasai.schemas import ChatMessage, ChatSessionSummary

_SESSIONS: dict[str, dict] = {}


def _now() -> datetime:
    return datetime.now(UTC)


def create_session(title: str | None = None) -> dict[str, str]:
    session_id = str(uuid.uuid4())
    now = _now()
    _SESSIONS[session_id] = {
        "id": session_id,
        "title": title or "Learning chat",
        "created_at": now,
        "updated_at": now,
        "messages": [],
    }
    return {"id": session_id, "title": _SESSIONS[session_id]["title"]}


def ensure_session(session_id: str, title: str | None = None) -> None:
    if session_id not in _SESSIONS:
        now = _now()
        _SESSIONS[session_id] = {
            "id": session_id,
            "title": title or "Learning chat",
            "created_at": now,
            "updated_at": now,
            "messages": [],
        }


def list_sessions() -> list[ChatSessionSummary]:
    return sorted(
        [
            ChatSessionSummary(
                id=session["id"],
                title=session["title"],
                created_at=session["created_at"],
                updated_at=session["updated_at"],
                message_count=len(session["messages"]),
            )
            for session in _SESSIONS.values()
        ],
        key=lambda item: item.updated_at,
        reverse=True,
    )


def messages(session_id: str) -> list[ChatMessage]:
    ensure_session(session_id)
    return list(_SESSIONS[session_id]["messages"])


def add_message(session_id: str, role: Literal["user", "assistant", "system"], content: str) -> ChatMessage:
    ensure_session(session_id)
    message = ChatMessage(role=role, content=content, created_at=_now())
    _SESSIONS[session_id]["messages"].append(message)
    _SESSIONS[session_id]["updated_at"] = message.created_at
    if role == "user" and len(_SESSIONS[session_id]["messages"]) == 1:
        _SESSIONS[session_id]["title"] = content[:48] or _SESSIONS[session_id]["title"]
    return message
