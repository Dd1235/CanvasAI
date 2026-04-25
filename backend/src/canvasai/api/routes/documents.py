from fastapi import APIRouter, File, UploadFile

from canvasai.storage import documents as doc_store

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    return await doc_store.upload(file.filename or "unnamed", content)
