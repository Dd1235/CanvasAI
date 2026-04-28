from fastapi import APIRouter, HTTPException, Depends

from canvasai.schemas import (
    CreateSessionRequest,
    CreateSessionResponse,
    SessionDetail,
    SessionHistoryResponse,
    SessionSummary,
    SessionTurn,
)
from canvasai.storage import sessions as session_store
from canvasai.api.deps import get_current_user_id

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.get("", response_model=list[SessionSummary])
async def list_sessions(user_id: str = Depends(get_current_user_id)):
    return session_store.list_sessions(user_id)

@router.post("", response_model=CreateSessionResponse)
async def create_session(
    payload: CreateSessionRequest | None = None, 
    user_id: str = Depends(get_current_user_id)
):
    created = session_store.create_session(user_id, payload.title if payload else None)
    return CreateSessionResponse(**created)

@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str, user_id: str = Depends(get_current_user_id)):
    session = session_store.get_session(user_id, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or access denied")
    return session

@router.get("/{session_id}/history", response_model=SessionHistoryResponse)
async def get_history(session_id: str, user_id: str = Depends(get_current_user_id)):
    return SessionHistoryResponse(turns=session_store.history(user_id, session_id))

@router.post("/{session_id}/revert/{turn_index}", response_model=SessionTurn)
async def revert(session_id: str, turn_index: int, user_id: str = Depends(get_current_user_id)):
    turn = session_store.revert_to(user_id, session_id, turn_index)
    if turn is None:
        raise HTTPException(status_code=404, detail="Turn not found or access denied")
    return turn