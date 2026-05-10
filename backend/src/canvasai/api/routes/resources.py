from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from canvasai.storage.client import get_supabase

router = APIRouter(tags=["resources"])

class ResourceCreate(BaseModel):
    resource_type: str
    content: str
    metadata: dict = {}

@router.post("/sessions/{session_id}/resources")
async def add_resource(session_id: str, resource: ResourceCreate):
    db = get_supabase()
    
    # In a real production app, you would add logic here to:
    # 1. Scrape the URL if type is 'link'
    # 2. Extract text if type is 'pdf'
    
    data = {
        "session_id": session_id,
        "resource_type": resource.resource_type,
        "content": resource.content,
        "metadata": resource.metadata
    }
    
    response = db.table("canvas_resources").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to store resource")
        
    return {"status": "success", "id": response.data[0]["id"]}