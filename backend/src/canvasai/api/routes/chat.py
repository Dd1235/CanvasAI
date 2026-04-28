from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from canvasai.api.deps import get_current_user_id
from canvasai.llm.provider import get_provider
from canvasai.schemas import (
    ChatMessage,
    ChatSessionSummary,
    CreateChatSessionRequest,
    CreateChatSessionResponse,
    SendChatMessageRequest,
    SendChatMessageResponse,
)
from canvasai.storage import chat as chat_store

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions")
async def list_chat_sessions(user_id: str = Depends(get_current_user_id)) -> list[ChatSessionSummary]:
    return chat_store.list_sessions(user_id)


@router.post("/sessions")
async def create_chat_session(
    payload: CreateChatSessionRequest | None = None,
    user_id: str = Depends(get_current_user_id)
) -> CreateChatSessionResponse:
    created = chat_store.create_session(user_id, payload.title if payload else None)
    return CreateChatSessionResponse(**created)


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    user_id: str = Depends(get_current_user_id)
) -> list[ChatMessage]:
    return chat_store.messages(user_id, session_id)


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str, 
    payload: SendChatMessageRequest,
    user_id: str = Depends(get_current_user_id)
) -> SendChatMessageResponse:
    try:
        user_message = chat_store.add_message(user_id, session_id, "user", payload.message)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    history = chat_store.messages(user_id, session_id)[-10:]
    system = (
        "You are CanvasAI's learning chat. Be concise, visual, and concrete. "
        "Prefer examples, checks for understanding, and text descriptions of diagrams. "
        f"Use this teaching mode: {payload.visualization_tool}."
    )
    transcript = "\n".join(f"{message.role}: {message.content}" for message in history)
    answer = await get_provider().complete(system=system, user=transcript)
    assistant_message = chat_store.add_message(user_id, session_id, "assistant", answer)
    
    return SendChatMessageResponse(
        session_id=session_id,
        user_message=user_message,
        assistant_message=assistant_message,
    )