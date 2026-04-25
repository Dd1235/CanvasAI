from fastapi import APIRouter, HTTPException

from canvasai.schemas import (
    CreateSessionRequest,
    CreateSessionResponse,
    SessionDetail,
    SessionHistoryResponse,
    SessionSummary,
    SessionTurn,
)
from canvasai.storage import sessions as session_store

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("")
async def list_sessions() -> list[SessionSummary]:
    return session_store.list_sessions()


@router.post("")
async def create_session(payload: CreateSessionRequest | None = None) -> CreateSessionResponse:
    created = session_store.create_session(payload.title if payload else None)
    return CreateSessionResponse(**created)


@router.get("/{session_id}")
async def get_session(session_id: str) -> SessionDetail:
    session = session_store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session


@router.get("/{session_id}/history")
async def get_history(session_id: str) -> SessionHistoryResponse:
    return SessionHistoryResponse(turns=session_store.history(session_id))


@router.post("/{session_id}/revert/{turn_index}")
async def revert(session_id: str, turn_index: int) -> SessionTurn:
    turn = session_store.revert_to(session_id, turn_index)
    if turn is None:
        raise HTTPException(status_code=404, detail="turn not found")
    return turn
