from __future__ import annotations

import logging
import math
import re
import unicodedata
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field, replace
from difflib import SequenceMatcher

from canvasai.knowledge_graph.embeddings import cosine_similarity
from canvasai.schemas import KnowledgeGraphRelation

logger = logging.getLogger(__name__)

HIGH_MATCH_THRESHOLD = 0.86
AMBIGUOUS_MATCH_THRESHOLD = 0.60
EDGE_ENDPOINT_MATCH_THRESHOLD = 0.72
EMBEDDING_HIGH_THRESHOLD = 0.86
EMBEDDING_AMBIGUOUS_THRESHOLD = 0.78
SYMMETRIC_RELATIONS = {"analogous", "contrasts"}

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "for",
    "in",
    "into",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


@dataclass(slots=True)
class KGNodeCandidate:
    title: str
    summary: str = ""
    revision_prompt: str = ""
    aliases: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    cluster: str = "general"
    confidence: float = 0.65
    evidence: list[str] = field(default_factory=list)
    source_session_ids: list[str] = field(default_factory=list)
    embedding: list[float] | None = None


@dataclass(slots=True)
class KGEdgeCandidate:
    source_title: str
    target_title: str
    relation: KnowledgeGraphRelation = "extends"
    strength: float = 0.55
    evidence: str = ""
    confidence: float = 0.65
    source_session_ids: list[str] = field(default_factory=list)


@dataclass(slots=True)
class KGNodeRecord:
    id: str
    title: str
    summary: str
    revision_prompt: str
    mastery: float
    confidence: float
    cluster: str
    tags: list[str]
    evidence: list[str]
    source_session_ids: list[str]
    position: dict[str, float]
    aliases: list[str] = field(default_factory=list)
    embedding: list[float] | None = None


@dataclass(slots=True)
class KGEdgeRecord:
    id: str
    source: str
    target: str
    relation: KnowledgeGraphRelation
    strength: float
    evidence: str
    source_session_ids: list[str]


@dataclass(slots=True)
class MergedGraph:
    nodes: list[KGNodeRecord]
    edges: list[KGEdgeRecord]


SameConceptGate = Callable[[KGNodeCandidate, KGNodeRecord, float], Awaitable[bool]]


def normalize_topic_key(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value or "")
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    key = _NON_ALNUM.sub("-", ascii_value.lower()).strip("-")
    return key or "topic"


def lexical_similarity(left: str, right: str) -> float:
    left_key = normalize_topic_key(left)
    right_key = normalize_topic_key(right)
    if left_key == right_key:
        return 1.0

    left_tokens = set(_tokenize(left_key))
    right_tokens = set(_tokenize(right_key))
    if left_tokens or right_tokens:
        jaccard = len(left_tokens & right_tokens) / max(1, len(left_tokens | right_tokens))
    else:
        jaccard = 0.0

    sequence = SequenceMatcher(None, left_key, right_key).ratio() * 0.85
    return round(max(jaccard, sequence), 4)


async def merge_graph_candidates(
    *,
    existing_nodes: list[KGNodeRecord],
    existing_edges: list[KGEdgeRecord],
    candidate_nodes: list[KGNodeCandidate],
    candidate_edges: list[KGEdgeCandidate],
    same_concept_gate: SameConceptGate | None = None,
) -> MergedGraph:
    nodes = [replace(node, aliases=_clean_aliases([node.title, *node.aliases])) for node in existing_nodes]
    edges = _dedupe_existing_edges([replace(edge) for edge in existing_edges])
    alias_index = _build_alias_index(nodes)
    used_ids = {node.id for node in nodes}
    candidate_title_to_node_id: dict[str, str] = {}

    for candidate in candidate_nodes:
        if not candidate.title.strip():
            continue

        match = await _find_matching_node(candidate, nodes, alias_index, same_concept_gate)
        if match is None:
            node = _new_node(candidate, used_ids, len(nodes))
            nodes.append(node)
            used_ids.add(node.id)
            match = node
        else:
            merged = _merge_node(match, candidate)
            nodes[nodes.index(match)] = merged
            match = merged

        for alias in _candidate_aliases(candidate):
            key = normalize_topic_key(alias)
            alias_index[key] = match
            candidate_title_to_node_id[key] = match.id

    final_alias_index = _build_alias_index(nodes)
    edge_key_index = {_edge_key(edge.source, edge.target, edge.relation): edge for edge in edges}
    edge_ids = {edge.id for edge in edges}

    skipped_self_edges = 0
    for candidate in candidate_edges:
        source = _resolve_or_create_node(
            candidate.source_title,
            candidate_title_to_node_id,
            final_alias_index,
            nodes,
            used_ids,
            candidate.source_session_ids,
        )
        target = _resolve_or_create_node(
            candidate.target_title,
            candidate_title_to_node_id,
            final_alias_index,
            nodes,
            used_ids,
            candidate.source_session_ids,
        )
        if not source or not target:
            logger.info(
                "kg.merge: skipping edge (unresolvable endpoint) source=%r target=%r relation=%r",
                candidate.source_title,
                candidate.target_title,
                candidate.relation,
            )
            continue
        if source == target:
            skipped_self_edges += 1
            continue

        source, target = _canonical_edge_endpoints(source, target, candidate.relation)
        key = _edge_key(source, target, candidate.relation)
        existing = edge_key_index.get(key)
        if existing is None:
            edge = _new_edge(candidate, source, target, edge_ids)
            edges.append(edge)
            edge_key_index[key] = edge
            edge_ids.add(edge.id)
            continue

        merged_edge = _merge_edge(existing, candidate)
        edges[edges.index(existing)] = merged_edge
        edge_key_index[key] = merged_edge

    if skipped_self_edges:
        logger.info("kg.merge: skipped %d self-loop edges", skipped_self_edges)
    logger.info(
        "kg.merge: produced %d nodes, %d edges from %d candidate nodes, %d candidate edges",
        len(nodes),
        len(edges),
        len(candidate_nodes),
        len(candidate_edges),
    )
    return MergedGraph(nodes=nodes, edges=edges)


async def _find_matching_node(
    candidate: KGNodeCandidate,
    nodes: list[KGNodeRecord],
    alias_index: dict[str, KGNodeRecord],
    same_concept_gate: SameConceptGate | None,
) -> KGNodeRecord | None:
    for alias in _candidate_aliases(candidate):
        match = alias_index.get(normalize_topic_key(alias))
        if match is not None:
            return match

    best: tuple[float, KGNodeRecord] | None = None
    for node in nodes:
        node_aliases = [node.title, *node.aliases]
        lex = max(lexical_similarity(candidate.title, alias) for alias in node_aliases)
        emb = cosine_similarity(candidate.embedding, node.embedding) if candidate.embedding else 0.0
        # Use the stronger signal so semantic matches win when titles diverge.
        score = max(lex, _scale_embedding_score(emb))
        if best is None or score > best[0]:
            best = (score, node)

    if best is None:
        return None
    score, node = best
    if score >= HIGH_MATCH_THRESHOLD:
        return node
    if score >= AMBIGUOUS_MATCH_THRESHOLD and same_concept_gate is not None:
        return node if await same_concept_gate(candidate, node, score) else None
    return None


def _scale_embedding_score(embedding_score: float) -> float:
    """Map embedding cosine to the same [0,1] band the lexical thresholds use.

    Cosine for unrelated OpenAI embeddings sits ~0.2-0.4, so we shift the band
    to keep `HIGH_MATCH_THRESHOLD` meaningful for both signals.
    """
    if embedding_score >= EMBEDDING_HIGH_THRESHOLD:
        return 1.0
    if embedding_score >= EMBEDDING_AMBIGUOUS_THRESHOLD:
        return AMBIGUOUS_MATCH_THRESHOLD + (
            (embedding_score - EMBEDDING_AMBIGUOUS_THRESHOLD)
            / (EMBEDDING_HIGH_THRESHOLD - EMBEDDING_AMBIGUOUS_THRESHOLD)
        ) * (HIGH_MATCH_THRESHOLD - AMBIGUOUS_MATCH_THRESHOLD)
    return 0.0


def _new_node(candidate: KGNodeCandidate, used_ids: set[str], index: int) -> KGNodeRecord:
    base = normalize_topic_key(candidate.title)
    node_id = base
    suffix = 2
    while node_id in used_ids:
        node_id = f"{base}-{suffix}"
        suffix += 1

    summary = candidate.summary.strip() or f"Core concept extracted from {candidate.title}."
    revision_prompt = (
        candidate.revision_prompt.strip()
        or f"Explain {candidate.title} from memory, then name one example and one edge case."
    )
    cluster_source = candidate.cluster or (candidate.tags[0] if candidate.tags else "general")
    cluster = normalize_topic_key(cluster_source)
    return KGNodeRecord(
        id=node_id,
        title=candidate.title.strip(),
        summary=summary,
        revision_prompt=revision_prompt,
        mastery=0.45,
        confidence=_clamp(candidate.confidence),
        cluster=cluster,
        tags=_clean_list(candidate.tags),
        evidence=_clean_list(candidate.evidence),
        source_session_ids=_clean_list(candidate.source_session_ids),
        position=_stable_position(index),
        aliases=_clean_aliases(_candidate_aliases(candidate)),
        embedding=list(candidate.embedding) if candidate.embedding else None,
    )


def _merge_node(existing: KGNodeRecord, candidate: KGNodeCandidate) -> KGNodeRecord:
    summary = candidate.summary.strip() or existing.summary
    revision_prompt = candidate.revision_prompt.strip() or existing.revision_prompt
    cluster = existing.cluster if existing.cluster != "general" else (candidate.cluster or existing.cluster)
    # Prefer the freshest embedding so node text and vector stay in sync.
    embedding = list(candidate.embedding) if candidate.embedding else existing.embedding
    return replace(
        existing,
        summary=summary,
        revision_prompt=revision_prompt,
        confidence=round((existing.confidence + _clamp(candidate.confidence)) / 2, 2),
        cluster=normalize_topic_key(cluster),
        tags=_union(existing.tags, candidate.tags),
        evidence=_union(existing.evidence, candidate.evidence),
        source_session_ids=_union(existing.source_session_ids, candidate.source_session_ids),
        aliases=_clean_aliases(_union(existing.aliases, _candidate_aliases(candidate))),
        embedding=embedding,
    )


def _new_edge(
    candidate: KGEdgeCandidate,
    source: str,
    target: str,
    edge_ids: set[str],
) -> KGEdgeRecord:
    base = normalize_topic_key(f"{source}-{candidate.relation}-{target}")
    edge_id = base
    suffix = 2
    while edge_id in edge_ids:
        edge_id = f"{base}-{suffix}"
        suffix += 1

    return KGEdgeRecord(
        id=edge_id,
        source=source,
        target=target,
        relation=candidate.relation,
        strength=_clamp((candidate.strength + candidate.confidence) / 2),
        evidence=candidate.evidence.strip() or f"{source} {candidate.relation} {target}.",
        source_session_ids=_clean_list(candidate.source_session_ids),
    )


def _merge_edge(existing: KGEdgeRecord, candidate: KGEdgeCandidate) -> KGEdgeRecord:
    return replace(
        existing,
        strength=round(max(existing.strength, _clamp((candidate.strength + candidate.confidence) / 2)), 2),
        evidence=_merge_evidence_text(existing.evidence, candidate.evidence),
        source_session_ids=_union(existing.source_session_ids, candidate.source_session_ids),
    )


def _dedupe_existing_edges(edges: list[KGEdgeRecord]) -> list[KGEdgeRecord]:
    deduped: list[KGEdgeRecord] = []
    index: dict[tuple[str, str, KnowledgeGraphRelation], KGEdgeRecord] = {}
    for edge in edges:
        source, target = _canonical_edge_endpoints(edge.source, edge.target, edge.relation)
        canonical = replace(edge, source=source, target=target)
        key = _edge_key(source, target, edge.relation)
        existing = index.get(key)
        if existing is None:
            index[key] = canonical
            deduped.append(canonical)
            continue
        merged = replace(
            existing,
            strength=max(existing.strength, canonical.strength),
            evidence=_merge_evidence_text(existing.evidence, canonical.evidence),
            source_session_ids=_union(existing.source_session_ids, canonical.source_session_ids),
        )
        deduped[deduped.index(existing)] = merged
        index[key] = merged
    return deduped


def _edge_key(source: str, target: str, relation: KnowledgeGraphRelation) -> tuple[str, str, KnowledgeGraphRelation]:
    source, target = _canonical_edge_endpoints(source, target, relation)
    return source, target, relation


def _canonical_edge_endpoints(
    source: str,
    target: str,
    relation: KnowledgeGraphRelation,
) -> tuple[str, str]:
    if relation in SYMMETRIC_RELATIONS and source > target:
        return target, source
    return source, target


def _candidate_aliases(candidate: KGNodeCandidate) -> list[str]:
    return [candidate.title, *candidate.aliases]


def _resolve_node_id(
    title: str,
    candidate_title_to_node_id: dict[str, str],
    alias_index: dict[str, KGNodeRecord],
) -> str | None:
    key = normalize_topic_key(title)
    if key in candidate_title_to_node_id:
        return candidate_title_to_node_id[key]
    match = alias_index.get(key)
    if match:
        return match.id

    best: tuple[float, KGNodeRecord] | None = None
    for alias_key, node in alias_index.items():
        score = lexical_similarity(key, alias_key)
        if best is None or score > best[0]:
            best = (score, node)
    if best and best[0] >= EDGE_ENDPOINT_MATCH_THRESHOLD:
        return best[1].id
    return None


def _resolve_or_create_node(
    title: str,
    candidate_title_to_node_id: dict[str, str],
    alias_index: dict[str, KGNodeRecord],
    nodes: list[KGNodeRecord],
    used_ids: set[str],
    source_session_ids: list[str],
) -> str | None:
    clean_title = (title or "").strip()
    if not clean_title:
        return None
    resolved = _resolve_node_id(clean_title, candidate_title_to_node_id, alias_index)
    if resolved:
        return resolved

    placeholder = _placeholder_node(clean_title, used_ids, len(nodes), source_session_ids)
    nodes.append(placeholder)
    used_ids.add(placeholder.id)
    key = normalize_topic_key(clean_title)
    alias_index[key] = placeholder
    candidate_title_to_node_id[key] = placeholder.id
    logger.info(
        "kg.merge: created placeholder node id=%r title=%r for unresolved edge endpoint",
        placeholder.id,
        clean_title,
    )
    return placeholder.id


def _placeholder_node(
    title: str,
    used_ids: set[str],
    index: int,
    source_session_ids: list[str],
) -> KGNodeRecord:
    base = normalize_topic_key(title)
    node_id = base
    suffix = 2
    while node_id in used_ids:
        node_id = f"{base}-{suffix}"
        suffix += 1
    return KGNodeRecord(
        id=node_id,
        title=title,
        summary=f"{title} (referenced by an extracted edge; not yet enriched).",
        revision_prompt=f"Briefly explain {title} and how it connects to the linked concept.",
        mastery=0.3,
        confidence=0.4,
        cluster="general",
        tags=[],
        evidence=["edge-endpoint-placeholder"],
        source_session_ids=_clean_list(source_session_ids),
        position=_stable_position(index),
        aliases=[title],
    )


def _build_alias_index(nodes: list[KGNodeRecord]) -> dict[str, KGNodeRecord]:
    index: dict[str, KGNodeRecord] = {}
    for node in nodes:
        for alias in [node.id, node.title, *node.aliases]:
            index[normalize_topic_key(alias)] = node
    return index


def _stable_position(index: int) -> dict[str, float]:
    angle = index * 2.399963229728653
    radius = 260 + (index // 8) * 120
    return {
        "x": round(math.cos(angle) * radius, 2),
        "y": round(math.sin(angle) * radius, 2),
    }


def _tokenize(key: str) -> list[str]:
    tokens: list[str] = []
    for token in key.split("-"):
        if not token or token in _STOPWORDS:
            continue
        if token.endswith("ing") and len(token) > 5:
            token = token[:-3]
        elif token.endswith("s") and len(token) > 3:
            token = token[:-1]
        tokens.append(token)
    return tokens


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return round(max(low, min(high, float(value))), 2)


def _clean_list(values: list[str]) -> list[str]:
    return [value for value in _union([], values) if value]


def _clean_aliases(values: list[str]) -> list[str]:
    aliases: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = value.strip()
        if not clean:
            continue
        key = normalize_topic_key(clean)
        if key in seen:
            continue
        seen.add(key)
        aliases.append(clean)
    return aliases[:12]


def _union(left: list[str], right: list[str]) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    for item in [*left, *right]:
        clean = str(item).strip()
        if not clean:
            continue
        key = clean.lower()
        if key in seen:
            continue
        seen.add(key)
        values.append(clean)
    return values


def _merge_evidence_text(left: str, right: str) -> str:
    clean_right = right.strip()
    if not clean_right or clean_right in left:
        return left
    if not left.strip():
        return clean_right
    return f"{left} | {clean_right}"
