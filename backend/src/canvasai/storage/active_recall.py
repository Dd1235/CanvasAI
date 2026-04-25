from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from canvasai.schemas import (
    ActiveRecallCard,
    ActiveRecallCardDraft,
    ActiveRecallSessionGroup,
    ActiveRecallStats,
    SessionSummary,
)

_CARDS: dict[str, ActiveRecallCard] = {}


def _now() -> datetime:
    return datetime.now(UTC)


def list_cards(session_id: str | None = None, due_only: bool = False) -> list[ActiveRecallCard]:
    now = _now()
    cards = list(_CARDS.values())
    if session_id:
        cards = [card for card in cards if card.session_id == session_id]
    if due_only:
        cards = [card for card in cards if card.due_at <= now]
    return sorted(cards, key=lambda card: card.due_at)


def stats() -> ActiveRecallStats:
    now = _now()
    session_ids = {card.session_id for card in _CARDS.values()}
    return ActiveRecallStats(
        total_cards=len(_CARDS),
        due_cards=sum(1 for card in _CARDS.values() if card.due_at <= now),
        sessions=len(session_ids),
    )


def list_session_groups(
    sessions: list[SessionSummary],
    *,
    due_only: bool = False,
) -> list[ActiveRecallSessionGroup]:
    cards = list_cards(due_only=due_only)
    summaries = {session.id: session for session in sessions}
    grouped: dict[str, list[ActiveRecallCard]] = {}
    for card in cards:
        grouped.setdefault(card.session_id, []).append(card)

    now = _now()
    groups: list[ActiveRecallSessionGroup] = []
    for session_id, session_cards in grouped.items():
        summary = summaries.get(session_id)
        updated_at = summary.updated_at if summary else max(card.updated_at for card in session_cards)
        groups.append(
            ActiveRecallSessionGroup(
                session_id=session_id,
                session_title=summary.title if summary else session_id,
                updated_at=updated_at,
                card_count=len(session_cards),
                due_count=sum(1 for card in session_cards if card.due_at <= now),
                cards=session_cards,
            )
        )

    return sorted(groups, key=lambda group: group.updated_at, reverse=True)


def replace_for_session(
    session_id: str,
    drafts: list[ActiveRecallCardDraft],
) -> tuple[list[ActiveRecallCard], int]:
    replaced = delete_session(session_id)
    now = _now()

    cards = [
        _new_card(
            session_id=session_id,
            front=draft.front,
            back=draft.back,
            tags=draft.tags,
            now=now,
        )
        for draft in drafts
    ]

    for card in cards:
        _CARDS[card.id] = card

    return cards, replaced


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
            back=(
                f"Use the prompt '{session_prompt}' and account for "
                f"{node_count} nodes / {edge_count} edges."
            ),
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


def delete_session(session_id: str) -> int:
    ids = [card_id for card_id, card in _CARDS.items() if card.session_id == session_id]
    for card_id in ids:
        del _CARDS[card_id]
    return len(ids)


def review(card_id: str, rating: str) -> ActiveRecallCard | None:
    card = _CARDS.get(card_id)
    if card is None:
        return None

    quality_by_rating = {
        "again": 1,
        "hard": 3,
        "good": 4,
        "easy": 5,
    }
    quality = quality_by_rating[rating]
    now = _now()

    if quality < 3:
        repetitions = 0
        interval = 1
    else:
        repetitions = card.repetitions + 1
        if repetitions == 1:
            interval = 1
        elif repetitions == 2:
            interval = 6
        else:
            interval = max(1, round(card.interval_days * card.ease_factor))

    ease = card.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease = max(1.3, ease)
    if rating == "easy":
        interval = max(interval + 2, round(interval * 1.3))
    if rating == "hard":
        interval = max(1, round(interval * 0.6))

    updated = card.model_copy(
        update={
            "ease_factor": round(ease, 2),
            "interval_days": interval,
            "repetitions": repetitions,
            "due_at": now + timedelta(days=interval),
            "last_reviewed_at": now,
            "updated_at": now,
        }
    )
    _CARDS[card_id] = updated
    return updated


def _new_card(
    *,
    session_id: str,
    front: str,
    back: str,
    tags: list[str],
    now: datetime,
) -> ActiveRecallCard:
    return ActiveRecallCard(
        id=str(uuid.uuid4()),
        session_id=session_id,
        front=front,
        back=back,
        tags=tags,
        due_at=now,
        created_at=now,
        updated_at=now,
    )
