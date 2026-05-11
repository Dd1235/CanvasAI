"""Mastery and confidence formulas for knowledge graph nodes.

The same formulas run in two places:

1. During a build (`pipeline.py`): for every merged node we recompute
   mastery/confidence using the user's persisted stats + the node's current
   graph context (edges, evidence, source sessions). This replaces the
   LLM-extracted guesses with deterministic signal-based scores.

2. After a sprint item completion (`/practice` endpoint): we bump
   practice_count + last_practiced_at and recompute that single node's
   mastery so the UI can show instant feedback.

Inputs are KG-only — no flashcards / chat coupling — so this module is safe
to evolve without coordinating with the rest of the app.

Formulas
--------
mastery = 0.5 * practice + 0.3 * coverage + 0.2 * recency
  practice = min(1, practice_count / PRACTICE_FULL_MARK)
  coverage = min(1, unique(source_session_ids) / COVERAGE_FULL_MARK)
  recency  = 2 ** (-days_since_practice / RECENCY_HALF_LIFE_DAYS)

confidence = 0.5 * edge_density + 0.5 * evidence_density
  edge_density     = min(1, edges_touching_node / EDGE_DENSITY_FULL_MARK)
  evidence_density = min(1, len(evidence) / EVIDENCE_DENSITY_FULL_MARK)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime

PRACTICE_FULL_MARK = 4
COVERAGE_FULL_MARK = 3
EDGE_DENSITY_FULL_MARK = 4
EVIDENCE_DENSITY_FULL_MARK = 3
RECENCY_HALF_LIFE_DAYS = 10.0


@dataclass(slots=True)
class TopicStats:
    practice_count: int = 0
    last_practiced_at: datetime | None = None


def compute_mastery(
    *,
    stats: TopicStats,
    source_session_ids: list[str],
    now: datetime | None = None,
) -> float:
    practice = min(1.0, stats.practice_count / PRACTICE_FULL_MARK)
    unique_sessions = len({sid for sid in source_session_ids if sid})
    coverage = min(1.0, unique_sessions / COVERAGE_FULL_MARK)
    recency = _recency_factor(stats.last_practiced_at, now=now)
    return _round(0.5 * practice + 0.3 * coverage + 0.2 * recency)


def compute_confidence(
    *,
    edges_touching_node: int,
    evidence_items: int,
) -> float:
    edge_density = min(1.0, edges_touching_node / EDGE_DENSITY_FULL_MARK)
    evidence_density = min(1.0, evidence_items / EVIDENCE_DENSITY_FULL_MARK)
    return _round(0.5 * edge_density + 0.5 * evidence_density)


def _recency_factor(last_practiced_at: datetime | None, *, now: datetime | None) -> float:
    if last_practiced_at is None:
        return 0.0
    current = now or datetime.now(UTC)
    if last_practiced_at.tzinfo is None:
        last_practiced_at = last_practiced_at.replace(tzinfo=UTC)
    days = max(0.0, (current - last_practiced_at).total_seconds() / 86400.0)
    return max(0.0, min(1.0, math.exp(-math.log(2) * days / RECENCY_HALF_LIFE_DAYS)))


def _round(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 2)
