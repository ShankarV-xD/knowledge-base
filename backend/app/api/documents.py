from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.client import get_db
from app.db import crud
from app.ingestion.pipeline import retry_document_background
from app.ingestion.queue import enqueue_ingestion
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("")
async def list_documents(
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    docs = await crud.get_user_documents(db, current_user_id)
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "source_type": d.source_type,
            "chunk_count": d.chunk_count,
            "token_count": d.token_count,
            "status": d.status,
            "error_message": d.error_message,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await crud.get_document(db, document_id)
    if not doc or doc.user_id != current_user_id:
        raise HTTPException(404, "Document not found")
    return {
        "id": str(doc.id),
        "title": doc.title,
        "source_type": doc.source_type,
        "chunk_count": doc.chunk_count,
        "token_count": doc.token_count,
        "status": doc.status,
        "error_message": doc.error_message,
        "file_path": doc.file_path,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }


class RenameDocumentRequest(BaseModel):
    title: str


@router.patch("/{document_id}")
async def rename_document(
    document_id: str,
    req: RenameDocumentRequest,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await crud.get_document(db, document_id)
    if not doc or doc.user_id != current_user_id:
        raise HTTPException(404, "Document not found")
    title = req.title.strip()
    if not title:
        raise HTTPException(400, "Title cannot be empty")
    await crud.rename_document(db, document_id, title)
    return {"status": "renamed"}


@router.get("/{document_id}/chunks")
async def get_document_chunks(
    document_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await crud.get_document(db, document_id)
    if not doc or doc.user_id != current_user_id:
        raise HTTPException(404, "Document not found")
    chunks = await crud.get_document_chunks(db, document_id)
    return {
        "document": {
            "id": str(doc.id),
            "title": doc.title,
            "source_type": doc.source_type,
            "chunk_count": doc.chunk_count,
            "token_count": doc.token_count,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        },
        "chunks": [
            {
                "id": str(c.id),
                "content": c.content,
                "heading": c.heading,
                "chunk_index": c.chunk_index,
                "page_number": c.page_number,
                "token_count": c.token_count,
            }
            for c in chunks
        ],
    }


@router.post("/{document_id}/retry")
async def retry_document(
    document_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    gemini_key = request.headers.get("x-gemini-key") or None
    if not gemini_key:
        raise HTTPException(400, "Add your Gemini API key before uploading.")

    doc = await crud.get_document(db, document_id)
    if not doc or doc.user_id != current_user_id:
        raise HTTPException(404, "Document not found")
    if not doc.file_path:
        raise HTTPException(400, "No source available for retry")

    is_url = doc.file_path.startswith("http://") or doc.file_path.startswith("https://")
    if not is_url and not Path(doc.file_path).exists():
        raise HTTPException(400, "Original file not found on disk")

    await crud.delete_document_chunks(db, document_id)
    await crud.update_document_status(db, document_id, "pending")

    await enqueue_ingestion(
        retry_document_background(
            document_id, current_user_id, doc.file_path,
            Path(doc.file_path).name if not is_url else "webpage",
            doc.source_type, doc.title, gemini_key,
        )
    )
    return {"status": "retrying"}


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await crud.get_document(db, document_id)
    if not doc or doc.user_id != current_user_id:
        raise HTTPException(404, "Document not found")
    await crud.delete_document(db, document_id)
    return {"status": "deleted"}
