from __future__ import annotations

import json
import logging
from typing import Any

from canvasai.knowledge_graph.merge import (
    KGEdgeCandidate,
    KGNodeCandidate,
    merge_graph_candidates,
    normalize_topic_key,
)
from canvasai.llm.provider import get_provider
from canvasai.schemas import KnowledgeGraphRelation
from canvasai.storage import knowledge_graph as kg_store

logger = logging.getLogger(__name__)

RELATIONS: set[str] = {"prerequisite", "extends", "analogous", "contrasts", "debugs"}


async def run_build_job(build_id: str) -> dict[str, Any]:
    job = kg_store.get_build_job(build_id)
    user_id = job["user_id"]
    session_id = str(job["session_id"]) if job.get("session_id") else None
    request_payload = job.get("request_payload") or {}

    kg_store.mark_build_job(build_id, "running")
    try:
        graph, graph_version_id = await build_graph_from_session_export(
            user_id=user_id,
            session_id=session_id,
            request_payload=request_payload,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("knowledge graph build failed for job %s", build_id)
        kg_store.mark_build_job(build_id, "failed", error=str(exc))
        raise

    kg_store.mark_build_job(build_id, "completed", graph_version_id=graph_version_id)
    return {
        "status": "completed",
        "graph_id": graph.graph_id,
        "version": graph.version,
        "nodes": len(graph.nodes),
        "edges": len(graph.edges),
    }


async def build_graph_from_session_export(
    *,
    user_id: str,
    session_id: str | None,
    request_payload: dict[str, Any],
):
    artifacts = kg_store.collect_build_artifacts(user_id, session_id, request_payload)
    existing_nodes, existing_edges = kg_store.get_latest_records(user_id)
    source_id = session_id or f"manual:{request_payload.get('title') or 'facts'}"
    candidate_nodes, candidate_edges = await extract_candidates(
        artifacts,
        source_id=source_id,
        existing_nodes=existing_nodes,
    )

    merged = await merge_graph_candidates(
        existing_nodes=existing_nodes,
        existing_edges=existing_edges,
        candidate_nodes=candidate_nodes,
        candidate_edges=candidate_edges,
        same_concept_gate=_same_concept_gate,
    )
    return kg_store.append_graph_version(
        user_id=user_id,
        source_summary=artifacts["source_summary"],
        nodes=merged.nodes,
        edges=merged.edges,
    )


async def extract_candidates(
    artifacts: dict[str, Any],
    *,
    source_id: str,
    existing_nodes: list | None = None,
) -> tuple[list[KGNodeCandidate], list[KGEdgeCandidate]]:
    fallback_nodes, fallback_edges = _fallback_candidates(artifacts, source_id=source_id)
    context = _extraction_context(artifacts, existing_nodes or [])
    system = (
        "Extract a learner knowledge graph from canvas/session data. "
        "If manual_title is present, treat it as the submitted topic title. "
        "Do not create sentence-fragment topic titles from terse facts; use the manual_title "
        "as the main concept unless it clearly duplicates an existing_graph title or alias. "
        "Create extra nodes for important named concepts mentioned in facts when they are needed "
        "to explain a relationship, such as partitions, brokers, topics, guarantees, protocols, "
        "data structures, algorithms, or system components. "
        "You will receive existing_graph nodes. Reuse their exact titles in edge endpoints "
        "when new facts relate to prior knowledge; only create a new node when the concept "
        "is not already represented by an existing title or alias. "
        "Return only JSON with shape "
        "{\"nodes\":[{\"title\":\"...\",\"summary\":\"...\",\"revision_prompt\":\"...\","
        "\"aliases\":[\"...\"],\"tags\":[\"...\"],\"cluster\":\"...\",\"confidence\":0.0,"
        "\"evidence\":[\"...\"]}],"
        "\"edges\":[{\"source_title\":\"...\",\"target_title\":\"...\","
        "\"relation\":\"prerequisite|extends|analogous|contrasts|debugs\","
        "\"strength\":0.0,\"confidence\":0.0,\"evidence\":\"...\"}]}. "
        "Edge endpoints must be either emitted node titles or exact existing_graph titles. "
        "Every node and edge must be evidence-backed. Keep unrelated topics disconnected."
    )

    try:
        raw = await get_provider().complete(system=system, user=json.dumps(context, default=str))
    except Exception as exc:  # noqa: BLE001
        logger.warning("kg.extract: LLM call failed (%s); using fallback candidates", exc)
        return fallback_nodes, fallback_edges

    nodes, edges = _parse_extraction(raw, source_id=source_id)
    logger.info(
        "kg.extract: parsed %d nodes and %d edges from LLM (raw_len=%d)",
        len(nodes),
        len(edges),
        len(raw or ""),
    )
    if not nodes and not edges:
        logger.info("kg.extract: empty LLM extraction — raw preview=%r", (raw or "")[:240])
    nodes = _ensure_manual_title_node(nodes, artifacts, source_id=source_id)
    enriched = await _enrich_sparse_manual_facts(
        artifacts,
        source_id=source_id,
        existing_nodes=existing_nodes or [],
    )
    if enriched is not None:
        enriched_node, enriched_edges = enriched
        nodes = _upsert_candidate_node(nodes, enriched_node)
        edges = [*edges, *enriched_edges]
        logger.info(
            "kg.extract: sparse-fact enrichment added node=%r and %d edges",
            enriched_node.title,
            len(enriched_edges),
        )
    edges = [
        *edges,
        *_same_category_edges_for_sparse_manual(
            artifacts,
            source_id=source_id,
            existing_nodes=existing_nodes or [],
            candidate_nodes=nodes,
        ),
    ]
    if not nodes:
        logger.info("kg.extract: no nodes after enrichment — using fallback candidates")
        return fallback_nodes, fallback_edges
    return nodes, edges or fallback_edges


async def _same_concept_gate(candidate: KGNodeCandidate, existing, score: float) -> bool:
    system = (
        "Decide whether two learning graph topics are the same concept. "
        "Return only JSON: {\"same_concept\":true|false,\"confidence\":0.0}."
    )
    user = {
        "candidate": {
            "title": candidate.title,
            "summary": candidate.summary,
            "aliases": candidate.aliases,
            "evidence": candidate.evidence,
        },
        "existing": {
            "id": existing.id,
            "title": existing.title,
            "summary": existing.summary,
            "aliases": existing.aliases,
            "evidence": existing.evidence,
        },
        "lexical_score": score,
    }
    try:
        raw = await get_provider().complete(system=system, user=json.dumps(user, default=str))
        data = json.loads(_extract_json(raw))
    except Exception:  # noqa: BLE001
        return False
    return bool(data.get("same_concept")) and float(data.get("confidence") or 0) >= 0.65


def _extraction_context(artifacts: dict[str, Any], existing_nodes: list) -> dict[str, Any]:
    latest_canvas = artifacts.get("latest_canvas") or {"nodes": [], "edges": []}
    return {
        "session": artifacts.get("session"),
        "manual_title": artifacts.get("manual_title"),
        "latest_prompt": artifacts.get("latest_prompt"),
        "turn_prompts": [turn.get("prompt") for turn in (artifacts.get("turns") or [])[-8:]],
        "latest_canvas": _compact_canvas(latest_canvas),
        "facts": artifacts.get("facts"),
        "existing_graph": [
            {
                "id": node.id,
                "title": node.title,
                "aliases": node.aliases,
                "summary": node.summary,
                "tags": node.tags,
            }
            for node in existing_nodes[:40]
        ],
        "recall_cards": [
            {
                "front": card.get("front"),
                "back": card.get("back"),
                "tags": card.get("tags") or [],
                "repetitions": card.get("repetitions"),
                "last_reviewed_at": card.get("last_reviewed_at"),
            }
            for card in (artifacts.get("recall_cards") or [])[:24]
        ],
    }


def _fallback_candidates(
    artifacts: dict[str, Any],
    *,
    source_id: str,
) -> tuple[list[KGNodeCandidate], list[KGEdgeCandidate]]:
    latest_canvas = artifacts.get("latest_canvas") or {"nodes": [], "edges": []}
    canvas_nodes = latest_canvas.get("nodes") or []
    canvas_edges = latest_canvas.get("edges") or []
    node_title_by_id: dict[str, str] = {}
    candidates: list[KGNodeCandidate] = []
    seen: set[str] = set()

    for raw_node in canvas_nodes[:30]:
        node_id = str(raw_node.get("id") or "")
        data = raw_node.get("data") if isinstance(raw_node.get("data"), dict) else {}
        title = str(data.get("label") or raw_node.get("label") or node_id).strip()
        if not title:
            continue
        detail = str(data.get("detail") or "").strip()
        node_title_by_id[node_id] = title
        key = normalize_topic_key(title)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(
            KGNodeCandidate(
                title=title,
                summary=detail or f"{title} appears in the exported canvas.",
                revision_prompt=f"Explain {title} without looking at the canvas, then point to the supporting node.",
                aliases=[title],
                tags=_tags_from_title(title),
                cluster=_cluster_from_tags(_tags_from_title(title)),
                confidence=0.62,
                evidence=[f"canvas-node:{node_id}" if node_id else "canvas-node"],
                source_session_ids=[source_id],
            )
        )

    for fact in _fact_node_candidates(artifacts.get("facts"), source_id=source_id):
        key = normalize_topic_key(fact.title)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(fact)

    if not candidates and artifacts.get("latest_prompt"):
        title = _title_from_prompt(str(artifacts["latest_prompt"]))
        candidates.append(
            KGNodeCandidate(
                title=title,
                summary=str(artifacts["latest_prompt"])[:240],
                revision_prompt=f"State the main idea behind {title}, then give one concrete example.",
                aliases=[title],
                tags=_tags_from_title(title),
                cluster=_cluster_from_tags(_tags_from_title(title)),
                confidence=0.5,
                evidence=["session-prompt"],
                source_session_ids=[source_id],
            )
        )

    edge_candidates: list[KGEdgeCandidate] = []
    for raw_edge in canvas_edges[:40]:
        source_node_id = str(raw_edge.get("source") or "")
        target_id = str(raw_edge.get("target") or "")
        source_title = node_title_by_id.get(source_node_id)
        target_title = node_title_by_id.get(target_id)
        if not source_title or not target_title:
            continue
        edge_data = raw_edge.get("data") if isinstance(raw_edge.get("data"), dict) else {}
        label = str(raw_edge.get("label") or edge_data.get("label") or "").strip()
        edge_candidates.append(
            KGEdgeCandidate(
                source_title=source_title,
                target_title=target_title,
                relation=_infer_relation(label),
                strength=0.55,
                confidence=0.58,
                evidence=label or f"Canvas edge {source_node_id} -> {target_id}.",
                source_session_ids=[source_id],
            )
        )

    return candidates, edge_candidates


def _parse_extraction(raw: str, *, source_id: str) -> tuple[list[KGNodeCandidate], list[KGEdgeCandidate]]:
    try:
        data = json.loads(_extract_json(raw))
    except (json.JSONDecodeError, TypeError):
        return [], []
    if not isinstance(data, dict):
        return [], []

    raw_nodes = data.get("nodes") or data.get("topics") or data.get("concepts") or []
    raw_edges = data.get("edges") or data.get("relations") or []
    nodes: list[KGNodeCandidate] = []
    for item in raw_nodes[:40]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("name") or item.get("concept") or "").strip()
        if not title:
            continue
        nodes.append(
            KGNodeCandidate(
                title=title,
                summary=str(item.get("summary") or item.get("description") or "").strip(),
                revision_prompt=str(item.get("revision_prompt") or item.get("review_prompt") or "").strip(),
                aliases=_as_str_list(item.get("aliases")),
                tags=[tag.lower() for tag in _as_str_list(item.get("tags"))[:8]],
                cluster=str(item.get("cluster") or "general").strip() or "general",
                confidence=_as_float(item.get("confidence"), default=0.65),
                evidence=_as_str_list(item.get("evidence")) or ["llm-extraction"],
                source_session_ids=_as_str_list(item.get("source_session_ids")) or [source_id],
            )
        )

    edges: list[KGEdgeCandidate] = []
    for item in raw_edges[:80]:
        if not isinstance(item, dict):
            continue
        source = str(item.get("source_title") or item.get("source") or item.get("from") or "").strip()
        target = str(item.get("target_title") or item.get("target") or item.get("to") or "").strip()
        if not source or not target:
            continue
        relation = str(item.get("relation") or "").strip()
        edges.append(
            KGEdgeCandidate(
                source_title=source,
                target_title=target,
                relation=_valid_relation(relation),
                strength=_as_float(item.get("strength"), default=0.55),
                confidence=_as_float(item.get("confidence"), default=0.65),
                evidence=str(item.get("evidence") or "").strip(),
                source_session_ids=_as_str_list(item.get("source_session_ids")) or [source_id],
            )
        )

    return nodes, edges


async def _enrich_sparse_manual_facts(
    artifacts: dict[str, Any],
    *,
    source_id: str,
    existing_nodes: list,
) -> tuple[KGNodeCandidate, list[KGEdgeCandidate]] | None:
    if not _is_sparse_manual_fact(artifacts):
        return None

    manual_title = str(artifacts.get("manual_title") or "").strip()
    facts = str(artifacts.get("facts") or "").strip()
    system = (
        "You enrich sparse manual knowledge graph facts. Use general computer science "
        "knowledge when the user gives a very terse fact. Return only JSON with shape "
        "{\"node\":{\"title\":\"...\",\"summary\":\"...\",\"revision_prompt\":\"...\","
        "\"aliases\":[\"...\"],\"tags\":[\"...\"],\"cluster\":\"...\","
        "\"confidence\":0.0,\"evidence\":\"...\"},"
        "\"edges\":[{\"source_title\":\"...\",\"target_title\":\"...\","
        "\"relation\":\"prerequisite|extends|analogous|contrasts|debugs\","
        "\"strength\":0.0,\"confidence\":0.0,\"evidence\":\"...\"}]}. "
        "The node title should be the manual_title unless that duplicates an existing title. "
        "Add edges to existing_graph nodes that share a category or prerequisite relationship. "
        "For performance optimization techniques, connect them with analogous or extends edges."
    )
    user = {
        "manual_title": manual_title,
        "facts": facts,
        "existing_graph": _compact_existing_graph(existing_nodes),
    }

    try:
        raw = await get_provider().complete(system=system, user=json.dumps(user, default=str))
        data = json.loads(_extract_json(raw))
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(data, dict) or not isinstance(data.get("node"), dict):
        return None

    item = data["node"]
    title = str(item.get("title") or manual_title).strip() or manual_title
    node = KGNodeCandidate(
        title=title,
        summary=str(item.get("summary") or facts or title).strip(),
        revision_prompt=str(item.get("revision_prompt") or f"Explain {title} and connect it to related concepts.").strip(),
        aliases=_as_str_list(item.get("aliases")) or [title],
        tags=[tag.lower() for tag in _as_str_list(item.get("tags"))[:8]],
        cluster=str(item.get("cluster") or "general").strip() or "general",
        confidence=_as_float(item.get("confidence"), default=0.72),
        evidence=_as_str_list(item.get("evidence")) or ["llm-background-enrichment"],
        source_session_ids=[source_id],
    )

    edges: list[KGEdgeCandidate] = []
    for edge in data.get("edges") or []:
        if not isinstance(edge, dict):
            continue
        source = str(edge.get("source_title") or edge.get("source") or "").strip()
        target = str(edge.get("target_title") or edge.get("target") or "").strip()
        if not source or not target:
            continue
        edges.append(
            KGEdgeCandidate(
                source_title=source,
                target_title=target,
                relation=_valid_relation(str(edge.get("relation") or "")),
                strength=_as_float(edge.get("strength"), default=0.62),
                confidence=_as_float(edge.get("confidence"), default=0.68),
                evidence=str(edge.get("evidence") or "").strip(),
                source_session_ids=[source_id],
            )
        )
    return node, edges


def _ensure_manual_title_node(
    nodes: list[KGNodeCandidate],
    artifacts: dict[str, Any],
    *,
    source_id: str,
) -> list[KGNodeCandidate]:
    manual_title = str(artifacts.get("manual_title") or "").strip()
    facts = artifacts.get("facts")
    if not manual_title:
        return nodes

    for node in nodes:
        aliases = [node.title, *node.aliases]
        if any(_same_normalized_title(manual_title, alias) for alias in aliases):
            return nodes

    summary = str(facts or manual_title).strip()[:300]
    return [
        KGNodeCandidate(
            title=manual_title,
            summary=summary or f"Facts about {manual_title}.",
            revision_prompt=f"Explain {manual_title} and connect it to the related graph topics.",
            aliases=[manual_title],
            tags=_tags_from_title(manual_title),
            cluster=_cluster_from_tags(_tags_from_title(manual_title)),
            confidence=0.68,
            evidence=["manual-title"],
            source_session_ids=[source_id],
        ),
        *nodes,
    ]


def _upsert_candidate_node(nodes: list[KGNodeCandidate], incoming: KGNodeCandidate) -> list[KGNodeCandidate]:
    for index, node in enumerate(nodes):
        aliases = [node.title, *node.aliases]
        if any(_same_normalized_title(incoming.title, alias) for alias in aliases):
            nodes[index] = KGNodeCandidate(
                title=node.title,
                summary=incoming.summary or node.summary,
                revision_prompt=incoming.revision_prompt or node.revision_prompt,
                aliases=_dedupe_strs([*node.aliases, incoming.title, *incoming.aliases]),
                tags=_dedupe_strs([*node.tags, *incoming.tags]),
                cluster=incoming.cluster or node.cluster,
                confidence=max(node.confidence, incoming.confidence),
                evidence=_dedupe_strs([*node.evidence, *incoming.evidence]),
                source_session_ids=_dedupe_strs([*node.source_session_ids, *incoming.source_session_ids]),
            )
            return nodes
    return [incoming, *nodes]


def _same_category_edges_for_sparse_manual(
    artifacts: dict[str, Any],
    *,
    source_id: str,
    existing_nodes: list,
    candidate_nodes: list[KGNodeCandidate],
) -> list[KGEdgeCandidate]:
    if not _is_sparse_manual_fact(artifacts):
        return []
    manual_title = str(artifacts.get("manual_title") or "").strip()
    if not manual_title:
        return []

    candidate = next(
        (node for node in candidate_nodes if _same_normalized_title(node.title, manual_title)),
        candidate_nodes[0] if candidate_nodes else None,
    )
    if candidate is None or not _is_optimization_topic(candidate, str(artifacts.get("facts") or "")):
        return []

    edges: list[KGEdgeCandidate] = []
    for node in existing_nodes:
        if _same_normalized_title(node.title, manual_title):
            continue
        if not _is_optimization_record(node):
            continue
        edges.append(
            KGEdgeCandidate(
                source_title=manual_title,
                target_title=node.title,
                relation="analogous",
                strength=0.68,
                confidence=0.7,
                evidence=f"{manual_title} and {node.title} are both performance optimization techniques.",
                source_session_ids=[source_id],
            )
        )
    return edges[:4]


def _fact_node_candidates(facts: Any, *, source_id: str) -> list[KGNodeCandidate]:
    candidates: list[KGNodeCandidate] = []
    for index, fact in enumerate(_flatten_facts(facts)[:20]):
        if isinstance(fact, dict):
            title = str(fact.get("title") or fact.get("name") or fact.get("concept") or "").strip()
            summary = str(fact.get("summary") or fact.get("description") or fact.get("fact") or "").strip()
            tags = _as_str_list(fact.get("tags"))
        else:
            title = _title_from_prompt(str(fact))
            summary = str(fact)
            tags = _tags_from_title(title)
        if not title:
            continue
        candidates.append(
            KGNodeCandidate(
                title=title,
                summary=summary[:300],
                revision_prompt=f"Recall the key claim about {title}, then verify it against the source fact.",
                aliases=[title],
                tags=tags[:8],
                cluster=_cluster_from_tags(tags),
                confidence=0.6,
                evidence=[f"payload-fact:{index}"],
                source_session_ids=[source_id],
            )
        )
    return candidates


def _flatten_facts(facts: Any) -> list[Any]:
    if facts is None:
        return []
    if isinstance(facts, list):
        return facts
    if isinstance(facts, dict):
        for key in ("facts", "topics", "concepts", "nodes"):
            value = facts.get(key)
            if isinstance(value, list):
                return value
        return [facts]
    if isinstance(facts, str):
        return [part.strip() for part in facts.split("\n") if part.strip()]
    return [facts]


def _compact_canvas(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "nodes": [
            {
                "id": node.get("id"),
                "label": (node.get("data") or {}).get("label") if isinstance(node.get("data"), dict) else node.get("label"),
                "detail": (node.get("data") or {}).get("detail") if isinstance(node.get("data"), dict) else None,
            }
            for node in (payload.get("nodes") or [])[:24]
            if isinstance(node, dict)
        ],
        "edges": [
            {
                "id": edge.get("id"),
                "source": edge.get("source"),
                "target": edge.get("target"),
                "label": edge.get("label"),
            }
            for edge in (payload.get("edges") or [])[:36]
            if isinstance(edge, dict)
        ],
    }


def _compact_existing_graph(existing_nodes: list) -> list[dict[str, Any]]:
    return [
        {
            "id": node.id,
            "title": node.title,
            "aliases": node.aliases,
            "summary": node.summary,
            "tags": node.tags,
            "cluster": node.cluster,
        }
        for node in existing_nodes[:40]
    ]


def _extract_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = "\n".join(line for line in text.splitlines() if not line.strip().startswith("```")).strip()
    starts = [index for index in (text.find("{"), text.find("[")) if index >= 0]
    if not starts:
        return text
    start = min(starts)
    end = text.rfind("}" if text[start] == "{" else "]")
    return text[start : end + 1] if end >= start else text[start:]


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [str(value).strip()]


def _as_float(value: Any, *, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    return max(0.0, min(1.0, parsed))


def _valid_relation(value: str) -> KnowledgeGraphRelation:
    return value if value in RELATIONS else _infer_relation(value)


def _infer_relation(label: str) -> KnowledgeGraphRelation:
    key = normalize_topic_key(label)
    if "prereq" in key or "depends" in key or "before" in key:
        return "prerequisite"
    if "analog" in key or "similar" in key:
        return "analogous"
    if "contrast" in key or "different" in key or "versus" in key:
        return "contrasts"
    if "debug" in key or "misconception" in key or "probe" in key:
        return "debugs"
    return "extends"


def _tags_from_title(title: str) -> list[str]:
    return [token for token in normalize_topic_key(title).split("-")[:5] if token]


def _cluster_from_tags(tags: list[str]) -> str:
    if not tags:
        return "general"
    if {"kafka", "broker", "stream", "partition"} & set(tags):
        return "kafka"
    return tags[0]


def _title_from_prompt(prompt: str) -> str:
    words = [word.strip(" ,.;:!?()[]{}") for word in prompt.split()]
    clean_words = [word for word in words if word]
    return " ".join(clean_words[:6]) or "Session Concept"


def _same_normalized_title(left: str, right: str) -> bool:
    return normalize_topic_key(left) == normalize_topic_key(right)


def _is_sparse_manual_fact(artifacts: dict[str, Any]) -> bool:
    if not str(artifacts.get("manual_title") or "").strip():
        return False
    facts = str(artifacts.get("facts") or "").strip()
    words = [word for word in facts.split() if word]
    return bool(facts) and (len(words) <= 6 or len(facts) <= 80)


def _is_optimization_topic(candidate: KGNodeCandidate, facts: str) -> bool:
    text = " ".join([candidate.title, candidate.summary, candidate.cluster, facts, *candidate.tags]).lower()
    return any(term in text for term in ("optimization", "optimisation", "performance", "cache", "inlining"))


def _is_optimization_record(node) -> bool:
    text = " ".join([node.title, node.summary, node.cluster, *node.tags, *node.aliases]).lower()
    return any(term in text for term in ("optimization", "optimisation", "performance", "cache", "inlining"))


def _dedupe_strs(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = str(value).strip()
        if not clean:
            continue
        key = clean.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(clean)
    return result
