from __future__ import annotations

from datetime import UTC, datetime, timedelta

from canvasai.schemas import (
    ActiveRecallCard,
    ActiveRecallCardDraft,
    ActiveRecallSessionGroup,
    ActiveRecallStats,
    SessionSummary,
)
from canvasai.storage.client import get_supabase


def _now() -> datetime:
    return datetime.now(UTC)


def list_cards(user_id: str, session_id: str | None = None, due_only: bool = False) -> list[ActiveRecallCard]:
    db = get_supabase()
    query = db.table("recall_cards").select("*").eq("user_id", user_id)

    if session_id:
        query = query.eq("session_id", session_id)
    if due_only:
        query = query.lte("due_at", _now().isoformat())

    res = query.execute()
    return [_map_card(c) for c in res.data]


def stats(user_id: str) -> ActiveRecallStats:
    db = get_supabase()
    now_str = _now().isoformat()

    total_res = db.table("recall_cards").select("id", count="exact").eq("user_id", user_id).execute()
    due_res = db.table("recall_cards").select("id", count="exact").eq("user_id", user_id).lte("due_at", now_str).execute()

    sessions_res = db.table("recall_cards").select("session_id").eq("user_id", user_id).execute()
    distinct_sessions = len(set(row["session_id"] for row in sessions_res.data))

    return ActiveRecallStats(
        total_cards=total_res.count or 0,
        due_cards=due_res.count or 0,
        sessions=distinct_sessions,
    )


def list_session_groups(
    user_id: str,
    sessions: list[SessionSummary],
    *,
    due_only: bool = False,
) -> list[ActiveRecallSessionGroup]:
    cards = list_cards(user_id, due_only=due_only)
    summaries = {session.id: session for session in sessions}
    
    grouped: dict[str, list[ActiveRecallCard]] = {}
    for card in cards:
        grouped.setdefault(card.session_id, []).append(card)

    now = _now()
    groups: list[ActiveRecallSessionGroup] = []
    
    for session_id, session_cards in grouped.items():
        summary = summaries.get(session_id)
        updated_at = summary.updated_at if summary else max(card.updated_at for card in session_cards)
        due_count = sum(1 for card in session_cards if card.due_at <= now)
        
        if not due_only or due_count > 0:
            groups.append(
                ActiveRecallSessionGroup(
                    session_id=session_id,
                    session_title=summary.title if summary else session_id,
                    updated_at=updated_at,
                    card_count=len(session_cards),
                    due_count=due_count,
                    cards=session_cards,
                )
            )

    return sorted(groups, key=lambda group: group.updated_at, reverse=True)


def replace_for_session(
    user_id: str,
    session_id: str,
    drafts: list[ActiveRecallCardDraft],
) -> tuple[list[ActiveRecallCard], int]:
    db = get_supabase()
    replaced = delete_session(user_id, session_id)
    now = _now().isoformat()

    if not drafts:
        return [], replaced

    payload = [
        {
            "user_id": user_id,
            "session_id": session_id,
            "front": d.front,
            "back": d.back,
            "tags": d.tags,
            "ease_factor": 2.5,
            "interval_days": 0,
            "repetitions": 0,
            "due_at": now,
        }
        for d in drafts
    ]

    insert_res = db.table("recall_cards").insert(payload).execute()
    return [_map_card(c) for c in insert_res.data], replaced


def fallback_drafts(
    *,
    title: str | None = None,
    prompt: str | None = None,
    node_count: int = 0,
    edge_count: int = 0,
) -> list[ActiveRecallCardDraft]:
    topic = title or "this session"
    session_prompt = prompt or "the current canvas"
    return [
        ActiveRecallCardDraft(
            front=f"Explain the main invariant in {topic}.",
            back=f"Use the prompt '{session_prompt}' and account for {node_count} nodes / {edge_count} edges.",
            tags=["session", "canvas", "invariant"],
        ),
        ActiveRecallCardDraft(
            front=f"What misconception could appear in {topic}?",
            back="Name one incorrect interpretation, then point to the node or edge that corrects it.",
            tags=["misconception", "active-recall"],
        ),
        ActiveRecallCardDraft(
            front=f"What is the next useful check after studying {topic}?",
            back="Predict one canvas mutation or edge relationship before revealing the next deck step.",
            tags=["prediction", "deck"],
        ),
    ]


def delete_session(user_id: str, session_id: str) -> int:
    db = get_supabase()
    res = db.table("recall_cards").delete().eq("session_id", session_id).eq("user_id", user_id).execute()
    return len(res.data)


def review(user_id: str, card_id: str, rating: str) -> ActiveRecallCard | None:
    db = get_supabase()
    card_res = db.table("recall_cards").select("*").eq("id", card_id).eq("user_id", user_id).execute()
    
    if not card_res.data:
        return None

    card = card_res.data[0]
    quality = {"again": 1, "hard": 3, "good": 4, "easy": 5}.get(rating, 1)

    repetitions = card["repetitions"]
    ease_factor = float(card["ease_factor"])
    interval_days = card["interval_days"]

    if quality < 3:
        repetitions = 0
        interval_days = 1
        ease_factor = max(1.3, ease_factor - 0.2)
    else:
        if repetitions == 0:
            interval_days = 1
        elif repetitions == 1:
            interval_days = 6
        else:
            interval_days = int(round(interval_days * ease_factor))

        repetitions += 1
        ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        ease_factor = max(1.3, ease_factor)

        if rating == "easy":
            interval_days = max(interval_days, 2)
            interval_days = int(round(interval_days * 1.3))

    now = _now()
    due_at = now + timedelta(days=interval_days)

    update_res = db.table("recall_cards").update({
        "repetitions": repetitions,
        "interval_days": interval_days,
        "ease_factor": ease_factor,
        "due_at": due_at.isoformat(),
        "last_reviewed_at": now.isoformat(),
        "updated_at": now.isoformat()
    }).eq("id", card_id).execute()

    return _map_card(update_res.data[0])


def _map_card(row: dict) -> ActiveRecallCard:
    return ActiveRecallCard(
        id=row["id"],
        session_id=row["session_id"],
        front=row["front"],
        back=row["back"],
        tags=row["tags"],
        ease_factor=float(row["ease_factor"]),
        interval_days=row["interval_days"],
        repetitions=row["repetitions"],
        due_at=datetime.fromisoformat(row["due_at"]),
        last_reviewed_at=datetime.fromisoformat(row["last_reviewed_at"]) if row.get("last_reviewed_at") else None,
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"])
    )