"""Inngest function registry.

Mounted into FastAPI via `inngest.fast_api.serve(app, client, [functions])`.
Currently registers a no-op so the route exists; add real workflows here.
"""

from __future__ import annotations

import inngest

from canvasai.config import get_settings

inngest_client = inngest.Inngest(
    app_id=get_settings().inngest_app_id,
    is_production=False,
)


@inngest_client.create_function(
    fn_id="ping",
    trigger=inngest.TriggerEvent(event="canvasai/ping"),
)
async def ping(ctx: inngest.Context) -> dict[str, str]:
    return {"status": "pong", "event": ctx.event.name}


functions: list = [ping]
