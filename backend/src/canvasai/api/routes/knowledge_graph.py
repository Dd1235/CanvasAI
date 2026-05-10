from __future__ import annotations

import inngest
from fastapi import APIRouter, Depends, HTTPException, status

from canvasai.api.deps import get_current_user_id
from canvasai.inngest_app.functions import KNOWLEDGE_GRAPH_REBUILD_EVENT, inngest_client
from canvasai.knowledge_graph.pipeline import propose_from_text
from canvasai.schemas import (
    KnowledgeGraphCanvasFactsRequest,
    KnowledgeGraphExportRequest,
    KnowledgeGraphExportResponse,
    KnowledgeGraphManualFactsRequest,
    KnowledgeGraphMergeRequest,
    KnowledgeGraphPayload,
    KnowledgeGraphProposal,
    KnowledgeGraphProposeRequest,
)
from canvasai.storage import knowledge_graph as kg_store

router = APIRouter(prefix="/knowledge-graph", tags=["knowledge-graph"])


@router.get("/current", response_model=KnowledgeGraphPayload)
async def current_graph(user_id: str = Depends(get_current_user_id)) -> KnowledgeGraphPayload:
    return kg_store.get_current_graph(user_id)


@router.post("/from-session/{session_id}", response_model=KnowledgeGraphExportResponse)
async def export_from_session(
    session_id: str,
    payload: KnowledgeGraphExportRequest | None = None,
    user_id: str = Depends(get_current_user_id),
) -> KnowledgeGraphExportResponse:
    request_payload = payload.model_dump(mode="json") if payload else KnowledgeGraphExportRequest().model_dump(mode="json")
    build_id = kg_store.create_build_job(user_id, session_id, request_payload)

    try:
        await inngest_client.send(
            inngest.Event(
                name=KNOWLEDGE_GRAPH_REBUILD_EVENT,
                data={"build_id": build_id},
            )
        )
    except Exception as exc:  # noqa: BLE001
        kg_store.mark_build_job(build_id, "failed", error=f"Could not enqueue Inngest event: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Knowledge graph build job was created, but Inngest enqueue failed.",
        ) from exc

    return KnowledgeGraphExportResponse(
        graph_id=kg_store.graph_id_for_user(user_id),
        build_id=build_id,
        queued=True,
        message="Knowledge graph update queued.",
    )


@router.post("/extract", response_model=KnowledgeGraphProposal)
async def extract_proposal(
    payload: KnowledgeGraphProposeRequest,
    user_id: str = Depends(get_current_user_id),
) -> KnowledgeGraphProposal:
    """Run extraction synchronously and return proposed nodes/edges for review.

    Does not mutate the persisted graph. The frontend should display the
    proposal, let the user edit/accept, then POST the (possibly edited)
    payload back to ``/knowledge-graph/merge``.
    """
    return await propose_from_text(user_id=user_id, title=payload.title, text=payload.text)


@router.post("/merge", response_model=KnowledgeGraphExportResponse)
async def merge_reviewed_proposal(
    payload: KnowledgeGraphMergeRequest,
    user_id: str = Depends(get_current_user_id),
) -> KnowledgeGraphExportResponse:
    """Enqueue an async merge of a user-reviewed proposal."""
    if not payload.proposed_nodes and not payload.proposed_edges:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal is empty: at least one node or edge is required.",
        )

    request_payload = {
        "source_id": payload.source_id,
        "title": payload.title,
        "text": payload.text,
        "proposed_nodes": [node.model_dump(mode="json") for node in payload.proposed_nodes],
        "proposed_edges": [edge.model_dump(mode="json") for edge in payload.proposed_edges],
    }
    build_id = kg_store.create_build_job(
        user_id,
        None,
        request_payload,
        source_type="user_proposal",
    )

    try:
        await inngest_client.send(
            inngest.Event(
                name=KNOWLEDGE_GRAPH_REBUILD_EVENT,
                data={"build_id": build_id},
            )
        )
    except Exception as exc:  # noqa: BLE001
        kg_store.mark_build_job(build_id, "failed", error=f"Could not enqueue Inngest event: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Knowledge graph merge job was created, but Inngest enqueue failed.",
        ) from exc

    return KnowledgeGraphExportResponse(
        graph_id=kg_store.graph_id_for_user(user_id),
        build_id=build_id,
        queued=True,
        message="Reviewed proposal queued for merge.",
    )


@router.post("/from-facts", response_model=KnowledgeGraphExportResponse)
async def export_from_facts(
    payload: KnowledgeGraphCanvasFactsRequest,
    user_id: str = Depends(get_current_user_id),
) -> KnowledgeGraphExportResponse:
    """Async-merge a bundle of canvas-derived facts.

    Intended for the live canvas → KG pipeline (layer 1 hands off bundled
    `{title, description}` facts here). Runs the same extraction + merge
    pipeline as `/from-text`; no review step. Each fact becomes a candidate
    node with title + summary; the LLM extraction sees the bundle and
    proposes additional nodes/edges as needed.
    """
    facts_payload = [
        {"title": fact.title, "summary": fact.description, "description": fact.description}
        for fact in payload.facts
    ]
    request_payload = {
        "title": None,
        "prompt": "Canvas-derived facts bundle",
        "nodes": [],
        "edges": [],
        "facts": facts_payload,
    }
    build_id = kg_store.create_build_job(
        user_id,
        payload.session_id,
        request_payload,
        source_type="session_export" if payload.session_id else "manual_facts",
    )

    try:
        await inngest_client.send(
            inngest.Event(
                name=KNOWLEDGE_GRAPH_REBUILD_EVENT,
                data={"build_id": build_id},
            )
        )
    except Exception as exc:  # noqa: BLE001
        kg_store.mark_build_job(build_id, "failed", error=f"Could not enqueue Inngest event: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Knowledge graph facts job was created, but Inngest enqueue failed.",
        ) from exc

    return KnowledgeGraphExportResponse(
        graph_id=kg_store.graph_id_for_user(user_id),
        build_id=build_id,
        queued=True,
        message=f"Queued {len(payload.facts)} canvas facts for graph merge.",
    )


@router.post("/from-text", response_model=KnowledgeGraphExportResponse)
async def export_from_text(
    payload: KnowledgeGraphManualFactsRequest,
    user_id: str = Depends(get_current_user_id),
) -> KnowledgeGraphExportResponse:
    request_payload = {
        "title": payload.title,
        "prompt": payload.title or "Manual knowledge graph facts",
        "nodes": [],
        "edges": [],
        "facts": payload.text,
    }
    build_id = kg_store.create_build_job(
        user_id,
        None,
        request_payload,
        source_type="manual_facts",
    )

    try:
        await inngest_client.send(
            inngest.Event(
                name=KNOWLEDGE_GRAPH_REBUILD_EVENT,
                data={"build_id": build_id},
            )
        )
    except Exception as exc:  # noqa: BLE001
        kg_store.mark_build_job(build_id, "failed", error=f"Could not enqueue Inngest event: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Knowledge graph manual build job was created, but Inngest enqueue failed.",
        ) from exc

    return KnowledgeGraphExportResponse(
        graph_id=kg_store.graph_id_for_user(user_id),
        build_id=build_id,
        queued=True,
        message="Knowledge graph facts queued.",
    )
