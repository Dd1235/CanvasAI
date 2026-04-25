"""Session state log — append-only ledger backing the Time Machine.

Each turn writes a row to a `sessions` Postgres table:
    {id, session_id, turn_index, prompt, payload jsonb, created_at}

Stubbed: keeps an in-memory list per process. Replace with Supabase upserts
once the schema is provisioned.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from canvasai.schemas import CanvasPayload, SessionDetail, SessionSummary, SessionTurn

_LEDGER: dict[str, list[dict[str, Any]]] = defaultdict(list)
_SESSIONS: dict[str, dict[str, Any]] = {}


def _now() -> datetime:
    return datetime.now(UTC)


def create_session(title: str | None = None) -> dict[str, str]:
    session_id = str(uuid.uuid4())
    now = _now()
    _SESSIONS[session_id] = {
        "id": session_id,
        "title": title or "Untitled canvas session",
        "created_at": now,
        "updated_at": now,
    }
    return {"id": session_id, "title": _SESSIONS[session_id]["title"]}


def ensure_session(session_id: str, title: str | None = None) -> None:
    if session_id in _SESSIONS:
        return
    now = _now()
    _SESSIONS[session_id] = {
        "id": session_id,
        "title": title or session_id,
        "created_at": now,
        "updated_at": now,
    }


def list_sessions() -> list[SessionSummary]:
    summaries = [_summary(session_id) for session_id in _SESSIONS]
    return sorted(summaries, key=lambda item: item.updated_at, reverse=True)


def get_session(session_id: str) -> SessionDetail | None:
    if session_id not in _SESSIONS and session_id not in _LEDGER:
        return None
    ensure_session(session_id)
    summary = _summary(session_id)
    return SessionDetail(**summary.model_dump(), turns=history(session_id))


def append_turn(session_id: str, prompt: str, payload: dict[str, Any]) -> int:
    ensure_session(session_id, title=prompt[:48] or session_id)
    turn_index = len(_LEDGER[session_id])
    _LEDGER[session_id].append(
        {
            "prompt": prompt,
            "payload": payload,
            "turn_index": turn_index,
            "created_at": _now(),
        }
    )
    _SESSIONS[session_id]["updated_at"] = _now()
    if _SESSIONS[session_id]["title"] == session_id and prompt:
        _SESSIONS[session_id]["title"] = prompt[:48]
    return turn_index


def history(session_id: str) -> list[SessionTurn]:
    return [
        SessionTurn(
            prompt=turn["prompt"],
            payload=CanvasPayload.model_validate(turn["payload"]),
            turn_index=turn["turn_index"],
            created_at=turn.get("created_at") or _now(),
        )
        for turn in _LEDGER[session_id]
    ]


def revert_to(session_id: str, turn_index: int) -> SessionTurn | None:
    """Truncate the ledger to `turn_index` (inclusive) and return that turn."""
    log = _LEDGER[session_id]
    if turn_index < 0 or turn_index >= len(log):
        return None
    _LEDGER[session_id] = log[: turn_index + 1]
    _SESSIONS[session_id]["updated_at"] = _now()
    return history(session_id)[turn_index]


def _summary(session_id: str) -> SessionSummary:
    ensure_session(session_id)
    turns = _LEDGER[session_id]
    metadata = _SESSIONS[session_id]
    return SessionSummary(
        id=session_id,
        title=metadata["title"],
        created_at=metadata["created_at"],
        updated_at=metadata["updated_at"],
        turn_count=len(turns),
        last_prompt=turns[-1]["prompt"] if turns else None,
    )
