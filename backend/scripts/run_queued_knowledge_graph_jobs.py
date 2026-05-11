from __future__ import annotations

import asyncio

from canvasai.knowledge_graph.pipeline import run_build_job
from canvasai.storage.client import get_supabase_admin


async def main() -> None:
    db = get_supabase_admin()
    rows = (
        db.table("kg_build_jobs")
        .select("id,status,created_at")
        .eq("status", "queued")
        .order("created_at")
        .execute()
        .data
    )
    if not rows:
        print("No queued knowledge graph jobs.")
        return

    for row in rows:
        build_id = row["id"]
        print(f"Running queued knowledge graph job {build_id}...")
        result = await run_build_job(build_id)
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
