from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from canvasai.knowledge_graph.merge import KGEdgeRecord, KGNodeRecord
from canvasai.schemas import (
    CanvasPosition,
    KnowledgeGraphEdge,
    KnowledgeGraphNode,
    KnowledgeGraphPayload,
    KnowledgeGraphSourceSummary,
    KnowledgeGraphUpdatePlan,
)
from canvasai.storage.client import get_supabase_admin

logger = logging.getLogger(__name__)

READ_ENDPOINT = "GET /knowledge-graph/current"
WRITE_ENDPOINT = "POST /knowledge-graph/from-session/{session_id}"
MERGE_ALGORITHM = (
    "Extract candidate topics and relations from canvas/session facts, match by stable aliases "
    "and lexical similarity, ask an LLM only for ambiguous same-concept decisions, then append "
    "a new versioned Supabase graph snapshot."
)


def graph_id_for_user(user_id: str) -> str:
    return f"kg_{user_id}"


def empty_graph(user_id: str) -> KnowledgeGraphPayload:
    return KnowledgeGraphPayload(
        graph_id=graph_id_for_user(user_id),
        user_id=user_id,
        version=0,
        generated_at=datetime.now(UTC),
        source_summary=KnowledgeGraphSourceSummary(),
        nodes=[],
        edges=[],
        update_plan=_update_plan(notes=["No graph has been generated yet. Export a canvas session to build one."]),
    )


def get_current_graph(user_id: str) -> KnowledgeGraphPayload:
    latest = _latest_version_row(user_id)
    if latest is None:
        return empty_graph(user_id)

    db = get_supabase_admin()
    version_id = latest["id"]
    node_rows = (
        db.table("kg_nodes")
        .select("*")
        .eq("graph_version_id", version_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )
    edge_rows = (
        db.table("kg_edges")
        .select("*")
        .eq("graph_version_id", version_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )

    nodes = [_node_model(row) for row in node_rows]
    edges = [_edge_model(row) for row in edge_rows]
    return KnowledgeGraphPayload(
        graph_id=graph_id_for_user(user_id),
        user_id=user_id,
        version=int(latest["version"]),
        generated_at=_parse_datetime(latest["generated_at"]),
        source_summary=KnowledgeGraphSourceSummary.model_validate(latest.get("source_summary") or {}),
        nodes=nodes,
        edges=edges,
        update_plan=KnowledgeGraphUpdatePlan.model_validate(latest.get("update_plan") or _update_plan().model_dump()),
    )


def get_latest_records(user_id: str) -> tuple[list[KGNodeRecord], list[KGEdgeRecord]]:
    payload = get_current_graph(user_id)
    extras = _node_extras_from_storage(user_id, payload.version)
    nodes = [
        KGNodeRecord(
            id=node.id,
            title=node.title,
            summary=node.summary,
            revision_prompt=node.revision_prompt,
            mastery=node.mastery,
            confidence=node.confidence,
            cluster=node.cluster,
            tags=node.tags,
            evidence=node.evidence,
            source_session_ids=node.source_session_ids,
            position={"x": node.position.x, "y": node.position.y},
            aliases=extras.get(node.id, {}).get("aliases", []),
            embedding=extras.get(node.id, {}).get("embedding"),
        )
        for node in payload.nodes
    ]
    edges = [
        KGEdgeRecord(
            id=edge.id,
            source=edge.source,
            target=edge.target,
            relation=edge.relation,
            strength=edge.strength,
            evidence=edge.evidence,
            source_session_ids=edge.source_session_ids,
        )
        for edge in payload.edges
    ]
    return nodes, edges


def create_build_job(
    user_id: str,
    session_id: str | None,
    request_payload: dict[str, Any],
    *,
    source_type: str = "session_export",
) -> str:
    db = get_supabase_admin()
    session_uuid = str(UUID(session_id)) if session_id else None
    res = (
        db.table("kg_build_jobs")
        .insert(
            {
                "user_id": user_id,
                "source_type": source_type,
                "session_id": session_uuid,
                "status": "queued",
                "request_payload": request_payload,
            }
        )
        .execute()
    )
    return res.data[0]["id"]


def get_build_job(build_id: str) -> dict[str, Any]:
    db = get_supabase_admin()
    res = db.table("kg_build_jobs").select("*").eq("id", build_id).execute()
    if not res.data:
        raise ValueError(f"Knowledge graph build job not found: {build_id}")
    return res.data[0]


def mark_build_job(
    build_id: str,
    status: str,
    *,
    graph_version_id: str | None = None,
    error: str | None = None,
) -> None:
    payload: dict[str, Any] = {"status": status, "updated_at": datetime.now(UTC).isoformat()}
    if status == "running":
        payload["started_at"] = datetime.now(UTC).isoformat()
    if status in {"completed", "failed"}:
        payload["finished_at"] = datetime.now(UTC).isoformat()
    if graph_version_id is not None:
        payload["graph_version_id"] = graph_version_id
    if error is not None:
        payload["error"] = error[:2000]

    get_supabase_admin().table("kg_build_jobs").update(payload).eq("id", build_id).execute()


def append_graph_version(
    *,
    user_id: str,
    source_summary: KnowledgeGraphSourceSummary,
    nodes: list[KGNodeRecord],
    edges: list[KGEdgeRecord],
) -> tuple[KnowledgeGraphPayload, str]:
    db = get_supabase_admin()
    next_version = _next_version(user_id)
    version_res = (
        db.table("kg_versions")
        .insert(
            {
                "user_id": user_id,
                "version": next_version,
                "source_summary": source_summary.model_dump(mode="json"),
                "update_plan": _update_plan(
                    notes=[
                        "Supabase is the canonical graph store for this MVP.",
                        "LLMs extract and summarize; deterministic code owns merging and versioning.",
                    ]
                ).model_dump(mode="json"),
            }
        )
        .execute()
    )
    version_row = version_res.data[0]
    graph_version_id = version_row["id"]

    if nodes:
        node_rows = [_node_row(graph_version_id, user_id, node) for node in nodes]
        try:
            db.table("kg_nodes").insert(node_rows).execute()
        except Exception as exc:  # noqa: BLE001
            # Older deployments without the pgvector migration applied will
            # reject the embedding column. Retry without embeddings so the
            # build still completes.
            if "embedding" not in str(exc):
                raise
            logger.info("kg storage: retrying node insert without embedding column (%s)", exc)
            for row in node_rows:
                row.pop("embedding", None)
            db.table("kg_nodes").insert(node_rows).execute()
    if edges:
        db.table("kg_edges").insert([_edge_row(graph_version_id, user_id, edge) for edge in edges]).execute()

    return get_current_graph(user_id), graph_version_id


def collect_build_artifacts(user_id: str, session_id: str | None, request_payload: dict[str, Any]) -> dict[str, Any]:
    db = get_supabase_admin()
    session = None
    turns: list[dict[str, Any]] = []
    if session_id:
        session = _safe_single(
            lambda: db.table("canvas_sessions").select("*").eq("id", session_id).eq("user_id", user_id).execute().data
        )
        turns = _safe_rows(
            lambda: (
                db.table("canvas_turns")
                .select("*")
                .eq("session_id", session_id)
                .order("turn_index")
                .execute()
                .data
            )
        )
    recall_query = db.table("recall_cards").select("*").eq("user_id", user_id)
    if session_id:
        recall_query = recall_query.eq("session_id", session_id)
    recall_cards = _safe_rows(lambda: recall_query.execute().data)

    latest_turn = turns[-1] if turns else None
    request_nodes = request_payload.get("nodes") or []
    request_edges = request_payload.get("edges") or []
    latest_payload = (
        {"nodes": request_nodes, "edges": request_edges}
        if request_nodes or request_edges
        else (latest_turn.get("payload") if latest_turn else {"nodes": [], "edges": []})
    )
    prompt = request_payload.get("prompt") or (latest_turn.get("prompt") if latest_turn else None)

    total_sessions = _safe_count(lambda: db.table("canvas_sessions").select("id", count="exact").eq("user_id", user_id).execute())
    total_cards = _safe_count(lambda: db.table("recall_cards").select("id", count="exact").eq("user_id", user_id).execute())

    return {
        "session": session,
        "turns": turns,
        "manual_title": request_payload.get("title"),
        "latest_prompt": prompt,
        "latest_canvas": latest_payload,
        "facts": request_payload.get("facts"),
        "recall_cards": recall_cards,
        "source_summary": KnowledgeGraphSourceSummary(
            sessions=total_sessions or (1 if session or request_nodes or request_edges else 0),
            documents=0,
            cards=total_cards,
        ),
    }


def _latest_version_row(user_id: str) -> dict[str, Any] | None:
    res = (
        get_supabase_admin()
        .table("kg_versions")
        .select("*")
        .eq("user_id", user_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _next_version(user_id: str) -> int:
    latest = _latest_version_row(user_id)
    return int(latest["version"]) + 1 if latest else 1


def _node_aliases_from_storage(user_id: str, version: int, node_id: str) -> list[str]:
    if version <= 0:
        return []
    latest = _latest_version_row(user_id)
    if latest is None:
        return []
    res = (
        get_supabase_admin()
        .table("kg_nodes")
        .select("aliases")
        .eq("graph_version_id", latest["id"])
        .eq("user_id", user_id)
        .eq("id", node_id)
        .execute()
    )
    return list(res.data[0].get("aliases") or []) if res.data else []


def _node_extras_from_storage(user_id: str, version: int) -> dict[str, dict[str, Any]]:
    """Bulk-load aliases + embeddings for the latest version's nodes.

    Embedding column is optional — older Supabase deployments without the
    pgvector migration return rows without it. Treat that as "no embedding".
    """
    if version <= 0:
        return {}
    latest = _latest_version_row(user_id)
    if latest is None:
        return {}
    try:
        res = (
            get_supabase_admin()
            .table("kg_nodes")
            .select("id,aliases,embedding")
            .eq("graph_version_id", latest["id"])
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
    except Exception as exc:  # noqa: BLE001
        logger.info("kg storage: embedding column missing or unreadable (%s)", exc)
        res = (
            get_supabase_admin()
            .table("kg_nodes")
            .select("id,aliases")
            .eq("graph_version_id", latest["id"])
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []

    extras: dict[str, dict[str, Any]] = {}
    for row in rows:
        extras[row["id"]] = {
            "aliases": list(row.get("aliases") or []),
            "embedding": _coerce_embedding(row.get("embedding")),
        }
    return extras


def _coerce_embedding(value: Any) -> list[float] | None:
    if value is None:
        return None
    if isinstance(value, list):
        return [float(item) for item in value]
    if isinstance(value, str):
        # pgvector returns "[0.1,0.2,...]" via PostgREST when the row is read raw.
        cleaned = value.strip().strip("[]")
        if not cleaned:
            return None
        try:
            return [float(item) for item in cleaned.split(",")]
        except ValueError:
            return None
    return None


def _node_model(row: dict[str, Any]) -> KnowledgeGraphNode:
    return KnowledgeGraphNode(
        id=row["id"],
        title=row["title"],
        summary=row["summary"],
        revision_prompt=row["revision_prompt"],
        mastery=float(row["mastery"]),
        confidence=float(row["confidence"]),
        cluster=row["cluster"],
        tags=list(row.get("tags") or []),
        evidence=list(row.get("evidence") or []),
        source_session_ids=list(row.get("source_session_ids") or []),
        position=CanvasPosition.model_validate(row["position"]),
    )


def _edge_model(row: dict[str, Any]) -> KnowledgeGraphEdge:
    return KnowledgeGraphEdge(
        id=row["id"],
        source=row["source"],
        target=row["target"],
        relation=row["relation"],
        strength=float(row["strength"]),
        evidence=row["evidence"],
        source_session_ids=list(row.get("source_session_ids") or []),
    )


def _node_row(graph_version_id: str, user_id: str, node: KGNodeRecord) -> dict[str, Any]:
    row: dict[str, Any] = {
        "graph_version_id": graph_version_id,
        "user_id": user_id,
        "id": node.id,
        "title": node.title,
        "summary": node.summary,
        "revision_prompt": node.revision_prompt,
        "mastery": node.mastery,
        "confidence": node.confidence,
        "cluster": node.cluster,
        "tags": node.tags,
        "evidence": node.evidence,
        "source_session_ids": node.source_session_ids,
        "position": node.position,
        "aliases": node.aliases,
    }
    if node.embedding:
        row["embedding"] = list(node.embedding)
    return row


def _edge_row(graph_version_id: str, user_id: str, edge: KGEdgeRecord) -> dict[str, Any]:
    return {
        "graph_version_id": graph_version_id,
        "user_id": user_id,
        "id": edge.id,
        "source": edge.source,
        "target": edge.target,
        "relation": edge.relation,
        "strength": edge.strength,
        "evidence": edge.evidence,
        "source_session_ids": edge.source_session_ids,
    }


def _update_plan(notes: list[str] | None = None) -> KnowledgeGraphUpdatePlan:
    return KnowledgeGraphUpdatePlan(
        trigger="session_export",
        read_endpoint=READ_ENDPOINT,
        write_endpoint=WRITE_ENDPOINT,
        algorithm=MERGE_ALGORITHM,
        notes=notes or [],
    )


def _parse_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _safe_rows(query) -> list[dict[str, Any]]:
    try:
        return list(query())
    except Exception as exc:  # noqa: BLE001
        logger.info("knowledge graph artifact query skipped: %s", exc)
        return []


def _safe_single(query) -> dict[str, Any] | None:
    rows = _safe_rows(query)
    return rows[0] if rows else None


def _safe_count(query) -> int:
    try:
        return int(query().count or 0)
    except Exception as exc:  # noqa: BLE001
        logger.info("knowledge graph count query skipped: %s", exc)
        return 0
