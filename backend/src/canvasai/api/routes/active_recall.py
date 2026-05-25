from __future__ import annotations

import ast
import json
import re

from fastapi import APIRouter, HTTPException, Depends
from pydantic import ValidationError

from canvasai.api.deps import get_current_user_id
from canvasai.llm.provider import get_provider
from canvasai.schemas import (
    ActiveRecallBuildRequest,
    ActiveRecallBuildResponse,
    ActiveRecallCard,
    ActiveRecallCardDraft,
    ActiveRecallReviewRequest,
    ActiveRecallSessionGroup,
    ActiveRecallStats,
    CanvasPayload,
    SessionTurn,
)
from canvasai.storage import active_recall as recall_store
from canvasai.storage import sessions as session_store

router = APIRouter(prefix="/active-recall", tags=["active-recall"])


@router.get("/cards")
async def list_cards(
    session_id: str | None = None, 
    due_only: bool = False,
    user_id: str = Depends(get_current_user_id)
) -> list[ActiveRecallCard]:
    return recall_store.list_cards(user_id, session_id=session_id, due_only=due_only)


@router.get("/sessions")
async def list_session_groups(
    due_only: bool = False,
    user_id: str = Depends(get_current_user_id)
) -> list[ActiveRecallSessionGroup]:
    user_sessions = session_store.list_sessions(user_id)
    return recall_store.list_session_groups(user_id, user_sessions, due_only=due_only)


@router.get("/stats")
async def stats(user_id: str = Depends(get_current_user_id)) -> ActiveRecallStats:
    return recall_store.stats(user_id)


@router.post("/from-session/{session_id}")
async def build_from_session(
    session_id: str,
    payload: ActiveRecallBuildRequest | None = None,
    user_id: str = Depends(get_current_user_id)
) -> ActiveRecallBuildResponse:
    session = session_store.get_session(user_id, session_id)
    turns = session.turns if session else []
    fallback_payload = None
    
    if payload:
        fallback_payload = CanvasPayload(nodes=payload.nodes, edges=payload.edges)
        
    title = payload.title if payload else session.title if session else None
    prompt = payload.prompt if payload else turns[-1].prompt if turns else None
    
    drafts = await _generate_recall_drafts(
        session_id=session_id,
        title=title,
        prompt=prompt,
        turns=turns,
        fallback_payload=fallback_payload,
    )
    
    session_store.ensure_session(user_id, session_id, title=title)
    cards, replaced_count = recall_store.replace_for_session(
        user_id,
        session_id,
        drafts,
    )
    return ActiveRecallBuildResponse(session_id=session_id, cards=cards, replaced_count=replaced_count)


@router.post("/cards/{card_id}/review")
async def review_card(
    card_id: str, 
    payload: ActiveRecallReviewRequest,
    user_id: str = Depends(get_current_user_id)
) -> ActiveRecallCard:
    card = recall_store.review(user_id, card_id, payload.rating)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found or access denied")
    return card


@router.delete("/sessions/{session_id}")
async def delete_session_cards(
    session_id: str,
    user_id: str = Depends(get_current_user_id)
) -> dict[str, int]:
    return {"deleted": recall_store.delete_session(user_id, session_id)}


async def _generate_recall_drafts(
    *,
    session_id: str,
    title: str | None,
    prompt: str | None,
    turns: list[SessionTurn],
    fallback_payload: CanvasPayload | None,
) -> list[ActiveRecallCardDraft]:
    payload = fallback_payload or (turns[-1].payload if turns else None)
    node_count = len(payload.nodes) if payload else 0
    edge_count = len(payload.edges) if payload else 0
    fallback = recall_store.fallback_drafts(
        title=title,
        prompt=prompt,
        node_count=node_count,
        edge_count=edge_count,
    )

    context = {
        "session_id": session_id,
        "title": title,
        "latest_prompt": prompt,
        "turn_count": len(turns),
        "turn_prompts": [turn.prompt for turn in turns[-8:]],
        "latest_canvas": _compact_payload(payload) if payload else {"nodes": [], "edges": []},
    }
    system = (
        "You create active recall cards from a visual tutoring canvas session. "
        "Treat the entire session as one lesson, not as separate turn records. "
        "Decide the useful number of cards from the actual content. Prefer 3-8 cards, "
        "but use fewer or more when the session genuinely needs it. Cover invariants, "
        "pointer/state changes, misconceptions, and prediction prompts. Do not mention turn numbers. "
        "Output only JSON: {\"cards\":[{\"front\":\"...\",\"back\":\"...\",\"tags\":[\"...\"]}]}."
    )

    try:
        raw = await get_provider().complete(system=system, user=json.dumps(context, default=str))
    except Exception:
        return fallback

    drafts = _parse_card_drafts(raw)
    return drafts or fallback


def _compact_payload(payload: CanvasPayload | None) -> dict[str, list[dict[str, object]]]:
    if payload is None:
        return {"nodes": [], "edges": []}
    return {
        "nodes": [
            {
                "id": node.id,
                # Using getattr instead of .get() since this is a Pydantic model
                "label": getattr(node.data, "label", None),
                "value": getattr(node.data, "value", None),
                "code": getattr(node.data, "code", None),
                "steps": getattr(node.data, "steps", None),
            }
            for node in payload.nodes[:16]
        ],
        "edges": [
            {
                "id": edge.id,
                "source": edge.source,
                "target": edge.target,
                "label": edge.label,
            }
            for edge in payload.edges[:24]
        ],
    }


def _parse_card_drafts(raw: str) -> list[ActiveRecallCardDraft]:
    clean_json_str = _extract_json(raw)
    
    # 1. Attempt to parse
    try:
        data = json.loads(clean_json_str, strict=False)
    except json.JSONDecodeError as e:
        # THE FIX: If standard JSON fails (due to single quotes from stringified Python objects)
        try:
            # Safely evaluate the string as a Python literal
            data = ast.literal_eval(clean_json_str)
        except (ValueError, SyntaxError):
            print(f"CRITICAL PARSE ERROR: {e}")
            print(f"ATTEMPTED TO PARSE: {repr(clean_json_str)}")
            return []

    # 2. Handle Gemini/LangChain weirdness (e.g., [{'text': '{"cards": ...}'}])
    if isinstance(data, list) and len(data) >= 1 and isinstance(data[0], dict) and "text" in data[0]:
        try:
             # Recursively parse the inner string
             return _parse_card_drafts(data[0]["text"])
        except Exception:
             pass

    # 3. Standard parsing logic
    items = data.get("cards") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []

    drafts: list[ActiveRecallCardDraft] = []
    for item in items[:12]:
        if not isinstance(item, dict):
            continue
        try:
            draft = ActiveRecallCardDraft.model_validate(item)
        except ValidationError:
            continue
        tags = [tag.strip().lower() for tag in draft.tags if tag.strip()]
        drafts.append(draft.model_copy(update={"tags": tags[:5]}))

    return drafts

def _extract_json(raw: str) -> str:
    """Aggressively extracts the first valid JSON object or array from a string."""
    text = raw.strip()
    
    # Strip markdown code blocks if present
    if text.startswith("```"):
        # Remove the first line (e.g., ```json) and the last line (```)
        lines = text.splitlines()
        if len(lines) >= 2:
            text = "\n".join(lines[1:-1]).strip()
            
    # Find the first { or [
    start_obj = text.find("{")
    start_arr = text.find("[")
    
    if start_obj == -1 and start_arr == -1:
        return text # Give up, return as is
        
    # Determine which starts first
    if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        start_char = "{"
        end_char = "}"
        start_idx = start_obj
    else:
        start_char = "["
        end_char = "]"
        start_idx = start_arr
        
    # Find the corresponding closing bracket by counting depth
    depth = 0
    for i in range(start_idx, len(text)):
        if text[i] == start_char:
            depth += 1
        elif text[i] == end_char:
            depth -= 1
            if depth == 0:
                # We found the matching end bracket
                return text[start_idx : i + 1]
                
    # Fallback if depth counting fails (e.g., malformed JSON at the end)
    return text[start_idx:]