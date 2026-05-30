"""Inngest function registry.

Mounted into FastAPI via `inngest.fast_api.serve(app, client, [functions])`.
Currently registers a no-op so the route exists; add real workflows here.
"""

from __future__ import annotations

import inngest

from canvasai.config import get_settings
from canvasai.knowledge_graph.pipeline import run_build_job

KNOWLEDGE_GRAPH_REBUILD_EVENT = "canvasai/knowledge_graph.rebuild"

settings = get_settings()
inngest_client = inngest.Inngest(
    app_id=settings.inngest_app_id,
    event_key=settings.inngest_event_key,
    signing_key=settings.inngest_signing_key,
    is_production=True,
)


@inngest_client.create_function(
    fn_id="ping",
    trigger=inngest.TriggerEvent(event="canvasai/ping"),
)
async def ping(ctx: inngest.Context) -> dict[str, str]:
    return {"status": "pong", "event": ctx.event.name}


@inngest_client.create_function(
    fn_id="knowledge-graph-rebuild",
    trigger=inngest.TriggerEvent(event=KNOWLEDGE_GRAPH_REBUILD_EVENT),
)
async def rebuild_knowledge_graph(ctx: inngest.Context) -> dict:
    build_id = str(ctx.event.data.get("build_id") or "")
    if not build_id:
        raise ValueError("knowledge graph rebuild event requires build_id")
    return await run_build_job(build_id)


functions: list = [ping, rebuild_knowledge_graph]
