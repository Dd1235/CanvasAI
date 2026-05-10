from __future__ import annotations

import inngest
from fastapi import APIRouter, Depends, HTTPException, status

from canvasai.api.deps import get_current_user_id
from canvasai.inngest_app.functions import KNOWLEDGE_GRAPH_REBUILD_EVENT, inngest_client
from canvasai.schemas import (
    KnowledgeGraphExportRequest,
    KnowledgeGraphExportResponse,
    KnowledgeGraphManualFactsRequest,
    KnowledgeGraphPayload,
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
