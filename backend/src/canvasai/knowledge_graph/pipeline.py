from __future__ import annotations

import ast
import json
import logging
from typing import Any

from dataclasses import replace

from canvasai.knowledge_graph.embeddings import cosine_similarity, embed_texts
from canvasai.knowledge_graph.merge import (
    KGEdgeCandidate,
    KGNodeCandidate,
    KGNodeRecord,
    lexical_similarity,
    merge_graph_candidates,
    normalize_topic_key,
)
from canvasai.llm.provider import get_provider
from canvasai.schemas import (
    KnowledgeGraphProposal,
    KnowledgeGraphProposalEdge,
    KnowledgeGraphProposalNode,
    KnowledgeGraphRelation,
)
from canvasai.storage import knowledge_graph as kg_store

logger = logging.getLogger(__name__)

RELATIONS: set[str] = {"prerequisite", "extends", "analogous", "contrasts", "debugs"}

# Candidate dedup runs against items produced from the *same* user input,
# so we can be more aggressive than the merge phase's HIGH_MATCH_THRESHOLD
# (0.86). A value of 0.75 catches single-character transpositions like
# "Throughput" vs "Throguhput" without merging genuinely distinct topics.
CANDIDATE_DEDUP_LEXICAL_THRESHOLD = 0.75
CANDIDATE_DEDUP_EMBEDDING_THRESHOLD = 0.9


async def run_build_job(build_id: str) -> dict[str, Any]:
    job = kg_store.get_build_job(build_id)
    user_id = job["user_id"]
    session_id = str(job["session_id"]) if job.get("session_id") else None
    request_payload = job.get("request_payload") or {}
    source_type = str(job.get("source_type") or "session_export")

    kg_store.mark_build_job(build_id, "running")
    try:
        if source_type == "user_proposal":
            graph, graph_version_id = await merge_proposal(
                user_id=user_id,
                source_id=str(request_payload.get("source_id") or f"proposal:{build_id}"),
                proposed_nodes=[
                    KnowledgeGraphProposalNode.model_validate(node)
                    for node in request_payload.get("proposed_nodes") or []
                ],
                proposed_edges=[
                    KnowledgeGraphProposalEdge.model_validate(edge)
                    for edge in request_payload.get("proposed_edges") or []
                ],
            )
        else:
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


async def propose_from_text(
    *,
    user_id: str,
    title: str | None,
    text: str,
) -> KnowledgeGraphProposal:
    """Run the LLM extraction step only and return a user-reviewable proposal.

    Does NOT persist anything. The caller is expected to send the proposal
    (potentially edited) back to ``merge_proposal`` to actually mutate the
    persisted graph.
    """
    request_payload = {
        "title": title,
        "prompt": title or "Manual knowledge graph facts",
        "nodes": [],
        "edges": [],
        "facts": text,
    }
    artifacts = kg_store.collect_build_artifacts(user_id, None, request_payload)
    existing_nodes, _existing_edges = kg_store.get_latest_records(user_id)
    source_id = f"manual:{title or 'facts'}"

    candidate_nodes, candidate_edges = await extract_candidates(
        artifacts,
        source_id=source_id,
        existing_nodes=existing_nodes,
    )
    await _attach_embeddings(candidate_nodes=candidate_nodes, existing_nodes=existing_nodes)
    candidate_nodes, candidate_edges = collapse_duplicate_candidates(
        candidate_nodes, candidate_edges
    )

    proposal_nodes = [
        _candidate_to_proposal_node(candidate, existing_nodes)
        for candidate in candidate_nodes
    ]
    proposal_edges = [
        KnowledgeGraphProposalEdge(
            source_title=edge.source_title,
            target_title=edge.target_title,
            relation=edge.relation,
            strength=edge.strength,
            confidence=edge.confidence,
            evidence=edge.evidence,
        )
        for edge in candidate_edges
    ]

    return KnowledgeGraphProposal(
        source_id=source_id,
        title=title,
        text=text,
        proposed_nodes=proposal_nodes,
        proposed_edges=proposal_edges,
        existing_node_titles=[node.title for node in existing_nodes[:60]],
    )


async def merge_proposal(
    *,
    user_id: str,
    source_id: str,
    proposed_nodes: list[KnowledgeGraphProposalNode],
    proposed_edges: list[KnowledgeGraphProposalEdge],
):
    """Apply a (user-reviewed) proposal to the persisted graph."""
    artifacts = kg_store.collect_build_artifacts(user_id, None, {"nodes": [], "edges": []})
    existing_nodes, existing_edges = kg_store.get_latest_records(user_id)

    candidate_nodes = [_proposal_to_candidate_node(node, source_id) for node in proposed_nodes]
    candidate_edges = [_proposal_to_candidate_edge(edge, source_id) for edge in proposed_edges]
    await _attach_embeddings(candidate_nodes=candidate_nodes, existing_nodes=existing_nodes)
    candidate_nodes, candidate_edges = collapse_duplicate_candidates(
        candidate_nodes, candidate_edges
    )

    merged = await merge_graph_candidates(
        existing_nodes=existing_nodes,
        existing_edges=existing_edges,
        candidate_nodes=candidate_nodes,
        candidate_edges=candidate_edges,
        same_concept_gate=_same_concept_gate,
    )
    kg_store.apply_mastery_scores(user_id=user_id, nodes=merged.nodes, edges=merged.edges)
    return kg_store.append_graph_version(
        user_id=user_id,
        source_summary=artifacts["source_summary"],
        nodes=merged.nodes,
        edges=merged.edges,
    )


def collapse_duplicate_candidates(
    candidate_nodes: list[KGNodeCandidate],
    candidate_edges: list[KGEdgeCandidate],
) -> tuple[list[KGNodeCandidate], list[KGEdgeCandidate]]:
    """Fold near-duplicate candidate nodes (typos, casing, embedding-similar) into one.

    The downstream merge phase already does this against the persisted graph,
    but the *proposal* shown to the user comes from the raw extraction —
    without this step the UI would show "Throughput" and "Throguhput" as two
    separate New nodes. After collapsing we also rewrite edge endpoints so
    references to the dropped title point at the survivor's title.
    """
    if not candidate_nodes:
        return candidate_nodes, candidate_edges

    survivors: list[KGNodeCandidate] = []
    title_remap: dict[str, str] = {}

    for candidate in candidate_nodes:
        match_index = _find_duplicate_index(candidate, survivors)
        if match_index is None:
            survivors.append(candidate)
            continue
        merged = _merge_candidate_pair(survivors[match_index], candidate)
        survivors[match_index] = merged
        for alias in [candidate.title, *candidate.aliases]:
            key = normalize_topic_key(alias)
            if key:
                title_remap[key] = merged.title
        logger.info(
            "kg.extract: collapsed duplicate candidate %r into %r",
            candidate.title,
            merged.title,
        )

    if not title_remap:
        return survivors, candidate_edges

    rewritten_edges: list[KGEdgeCandidate] = []
    for edge in candidate_edges:
        new_source = title_remap.get(normalize_topic_key(edge.source_title), edge.source_title)
        new_target = title_remap.get(normalize_topic_key(edge.target_title), edge.target_title)
        if normalize_topic_key(new_source) == normalize_topic_key(new_target):
            continue
        rewritten_edges.append(replace(edge, source_title=new_source, target_title=new_target))
    return survivors, rewritten_edges


def _find_duplicate_index(
    candidate: KGNodeCandidate,
    survivors: list[KGNodeCandidate],
) -> int | None:
    candidate_aliases = [candidate.title, *candidate.aliases]
    candidate_keys = {normalize_topic_key(a) for a in candidate_aliases if a}
    for index, survivor in enumerate(survivors):
        survivor_aliases = [survivor.title, *survivor.aliases]
        survivor_keys = {normalize_topic_key(a) for a in survivor_aliases if a}
        if candidate_keys & survivor_keys:
            return index
        lex = max(
            lexical_similarity(left, right)
            for left in candidate_aliases
            for right in survivor_aliases
        )
        if lex >= CANDIDATE_DEDUP_LEXICAL_THRESHOLD:
            return index
        if candidate.embedding and survivor.embedding:
            if cosine_similarity(candidate.embedding, survivor.embedding) >= CANDIDATE_DEDUP_EMBEDDING_THRESHOLD:
                return index
    return None


def _merge_candidate_pair(
    primary: KGNodeCandidate,
    other: KGNodeCandidate,
) -> KGNodeCandidate:
    # Pick the longer title as canonical — typos and lowercase variants tend
    # to be shorter or noisier than the well-formed version.
    canonical_title = primary.title if len(primary.title) >= len(other.title) else other.title
    canonical_summary = primary.summary if len(primary.summary) >= len(other.summary) else other.summary
    canonical_revision = (
        primary.revision_prompt
        if len(primary.revision_prompt) >= len(other.revision_prompt)
        else other.revision_prompt
    )
    embedding = primary.embedding or other.embedding
    return KGNodeCandidate(
        title=canonical_title.strip(),
        summary=canonical_summary,
        revision_prompt=canonical_revision,
        aliases=_dedupe_strs([primary.title, other.title, *primary.aliases, *other.aliases]),
        tags=_dedupe_strs([*primary.tags, *other.tags]),
        cluster=primary.cluster or other.cluster or "general",
        confidence=max(primary.confidence, other.confidence),
        evidence=_dedupe_strs([*primary.evidence, *other.evidence]),
        source_session_ids=_dedupe_strs([*primary.source_session_ids, *other.source_session_ids]),
        embedding=embedding,
    )


def _candidate_to_proposal_node(
    candidate: KGNodeCandidate,
    existing_nodes: list[KGNodeRecord],
) -> KnowledgeGraphProposalNode:
    matched_id, matched_title = _best_existing_match(candidate, existing_nodes)
    return KnowledgeGraphProposalNode(
        title=candidate.title,
        summary=candidate.summary,
        revision_prompt=candidate.revision_prompt,
        aliases=list(candidate.aliases),
        tags=list(candidate.tags),
        cluster=candidate.cluster,
        confidence=candidate.confidence,
        evidence=list(candidate.evidence),
        matched_existing_id=matched_id,
        matched_existing_title=matched_title,
        is_new=matched_id is None,
    )


def _best_existing_match(
    candidate: KGNodeCandidate,
    existing_nodes: list[KGNodeRecord],
) -> tuple[str | None, str | None]:
    if not existing_nodes:
        return None, None
    candidate_title_key = normalize_topic_key(candidate.title)
    for node in existing_nodes:
        for alias in [node.title, *node.aliases]:
            if normalize_topic_key(alias) == candidate_title_key:
                return node.id, node.title
    best: tuple[float, KGNodeRecord] | None = None
    for node in existing_nodes:
        for alias in [node.title, *node.aliases]:
            score = lexical_similarity(candidate.title, alias)
            if best is None or score > best[0]:
                best = (score, node)
    if best and best[0] >= 0.86:
        return best[1].id, best[1].title
    return None, None


def _proposal_to_candidate_node(
    node: KnowledgeGraphProposalNode,
    source_id: str,
) -> KGNodeCandidate:
    return KGNodeCandidate(
        title=node.title.strip(),
        summary=node.summary.strip(),
        revision_prompt=node.revision_prompt.strip(),
        aliases=list(node.aliases),
        tags=list(node.tags),
        cluster=node.cluster or "general",
        confidence=node.confidence,
        evidence=list(node.evidence) or ["user-confirmed"],
        source_session_ids=[source_id],
    )


def _proposal_to_candidate_edge(
    edge: KnowledgeGraphProposalEdge,
    source_id: str,
) -> KGEdgeCandidate:
    return KGEdgeCandidate(
        source_title=edge.source_title.strip(),
        target_title=edge.target_title.strip(),
        relation=edge.relation,
        strength=edge.strength,
        confidence=edge.confidence,
        evidence=edge.evidence.strip() or f"{edge.source_title} {edge.relation} {edge.target_title}.",
        source_session_ids=[source_id],
    )


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

    await _attach_embeddings(candidate_nodes=candidate_nodes, existing_nodes=existing_nodes)

    merged = await merge_graph_candidates(
        existing_nodes=existing_nodes,
        existing_edges=existing_edges,
        candidate_nodes=candidate_nodes,
        candidate_edges=candidate_edges,
        same_concept_gate=_same_concept_gate,
    )
    kg_store.apply_mastery_scores(user_id=user_id, nodes=merged.nodes, edges=merged.edges)
    return kg_store.append_graph_version(
        user_id=user_id,
        source_summary=artifacts["source_summary"],
        nodes=merged.nodes,
        edges=merged.edges,
    )


async def _attach_embeddings(
    *,
    candidate_nodes: list[KGNodeCandidate],
    existing_nodes: list[KGNodeRecord],
) -> None:
    """Populate `.embedding` on candidates and existing nodes that lack one.

    Cheap call when no API key is set: ``embed_texts`` returns Nones and merge
    falls back to lexical similarity only.
    """
    targets: list[tuple[Any, str]] = []
    for candidate in candidate_nodes:
        if candidate.embedding:
            continue
        targets.append((candidate, _embedding_text(candidate.title, candidate.summary)))
    for record in existing_nodes:
        if record.embedding:
            continue
        targets.append((record, _embedding_text(record.title, record.summary)))

    if not targets:
        return

    vectors = await embed_texts([text for _, text in targets])
    for (target, _), vector in zip(targets, vectors):
        target.embedding = vector


def _embedding_text(title: str, summary: str) -> str:
    title = (title or "").strip()
    summary = (summary or "").strip()
    if title and summary:
        return f"{title}. {summary}"
    return title or summary



async def extract_candidates(
    artifacts: dict[str, Any],
    *,
    source_id: str,
    existing_nodes: list | None = None,
) -> tuple[list[KGNodeCandidate], list[KGEdgeCandidate]]:
    fallback_nodes, fallback_edges = _fallback_candidates(artifacts, source_id=source_id)
    context = _extraction_context(artifacts, existing_nodes or [])
    
    # --- Updated System Prompt to use the Transcript ---
    system = (
        "Extract a learner knowledge graph from the provided 'lesson_transcript' and facts. "
        "The transcript contains exactly what was taught to the user. "
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
    # --- NEW: Extract the Zero-Cost Transcript ---
    turns = artifacts.get("turns") or []
    transcript_parts = []
    
    for turn in turns:
        # turn["payload"] is typically a dict here based on how we fetch it
        payload = turn.get("payload") or {}
        ai_text = payload.get("ai_response")
        if ai_text:
            transcript_parts.append(f"AI: {ai_text}")
            
    lesson_transcript = "\n\n".join(transcript_parts) if transcript_parts else "No transcript available."

    return {
        "session": artifacts.get("session"),
        "manual_title": artifacts.get("manual_title"),
        "latest_prompt": artifacts.get("latest_prompt"),
        "lesson_transcript": lesson_transcript,
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
        # --- Flashcards act as high-yield hints for the LLM ---
        "recall_cards": [
            {
                "front": card.get("front"),
                "back": card.get("back"),
                "tags": card.get("tags") or [],
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
    clean_json_str = _extract_json(raw)
    
    try:
        data = json.loads(clean_json_str, strict=False)
    except json.JSONDecodeError as e:
        # Fallback to ast literal evaluation for stringified Python objects
        try:
            data = ast.literal_eval(clean_json_str)
        except (ValueError, SyntaxError):
            logger.error(f"CRITICAL KG PARSE ERROR: {e}\nRaw: {repr(clean_json_str[:200])}")
            return [], []

    # Handle Gemini multimodal wrapper blocks
    if isinstance(data, list) and len(data) >= 1 and isinstance(data[0], dict) and "text" in data[0]:
        try:
             return _parse_extraction(data[0]["text"], source_id=source_id)
        except Exception:
             pass

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
    """Aggressively extracts the first valid JSON object or array from a string."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 2:
            text = "\n".join(lines[1:-1]).strip()
            
    start_obj = text.find("{")
    start_arr = text.find("[")
    
    if start_obj == -1 and start_arr == -1:
        return text 
        
    if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        start_char, end_char, start_idx = "{", "}", start_obj
    else:
        start_char, end_char, start_idx = "[", "]", start_arr
        
    depth = 0
    for i in range(start_idx, len(text)):
        if text[i] == start_char:
            depth += 1
        elif text[i] == end_char:
            depth -= 1
            if depth == 0:
                return text[start_idx : i + 1]
    return text[start_idx:]


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
