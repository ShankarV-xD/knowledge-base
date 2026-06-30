import mimetypes
from pathlib import Path
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.client import get_db
from app.db import crud
from app.ingestion.pipeline import retry_document_background
from app.ingestion.queue import enqueue_ingestion
from app.auth.dependency import get_current_user
from app.config import resolve_gemini_key
from app.storage import supabase_storage

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _content_disposition(name: str) -> str:
    """RFC 6266 header with a sanitized ASCII fallback plus a UTF-8 filename*.
    Strips quotes/CR/LF so a crafted upload filename cannot inject headers."""
    ascii_name = (
        name.encode("ascii", "ignore").decode()
        .replace('"', "").replace("\r", "").replace("\n", "").strip()
        or "download"
    )
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"


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


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await crud.get_document(db, document_id)
    if not doc or doc.user_id != current_user_id:
        raise HTTPException(404, "Document not found")
    if not doc.file_path:
        raise HTTPException(404, "No source file for this document")

    # URL imports have no stored blob; hand the original URL back as JSON
    # (avoids turning this origin into an open redirector).
    if doc.file_path.startswith(("http://", "https://")):
        return {"url": doc.file_path}

    if supabase_storage.is_storage_ref(doc.file_path):
        download_name = supabase_storage.object_key(doc.file_path).split("/")[-1].split("_", 1)[-1] or doc.title
        try:
            data = await supabase_storage.download_bytes(doc.file_path)
        except Exception as e:
            print(f"[download] storage fetch failed for {document_id}: {e}")
            raise HTTPException(502, "Failed to fetch file from storage")
        media_type = mimetypes.guess_type(download_name)[0] or "application/octet-stream"
        return Response(
            content=data,
            media_type=media_type,
            headers={"Content-Disposition": _content_disposition(download_name)},
        )

    # Legacy local-disk file
    if not Path(doc.file_path).exists():
        raise HTTPException(404, "Original file not found")
    download_name = Path(doc.file_path).name.split("_", 1)[-1] or doc.title
    media_type = mimetypes.guess_type(download_name)[0] or "application/octet-stream"
    return FileResponse(doc.file_path, media_type=media_type, filename=download_name)


@router.post("/{document_id}/retry")
async def retry_document(
    document_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    gemini_key = resolve_gemini_key(request.headers.get("x-gemini-key"))
    if not gemini_key:
        raise HTTPException(400, "Add your Gemini API key before uploading.")

    doc = await crud.get_document(db, document_id)
    if not doc or doc.user_id != current_user_id:
        raise HTTPException(404, "Document not found")
    if not doc.file_path:
        raise HTTPException(400, "No source available for retry")

    is_url = doc.file_path.startswith("http://") or doc.file_path.startswith("https://")
    is_storage = supabase_storage.is_storage_ref(doc.file_path)
    if not is_url and not is_storage and not Path(doc.file_path).exists():
        raise HTTPException(400, "Original file not found on disk")

    if is_url:
        filename = "webpage"
    elif is_storage:
        filename = supabase_storage.object_key(doc.file_path).split("/")[-1]
    else:
        filename = Path(doc.file_path).name

    await crud.delete_document_chunks(db, document_id)
    await crud.update_document_status(db, document_id, "pending")

    await enqueue_ingestion(
        retry_document_background(
            document_id, current_user_id, doc.file_path,
            filename, doc.source_type, doc.title, gemini_key,
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
    if supabase_storage.is_storage_ref(doc.file_path):
        try:
            await supabase_storage.delete_object(doc.file_path)
        except Exception:
            pass  # best-effort; don't block the DB delete on a storage hiccup
    await crud.delete_document(db, document_id)
    return {"status": "deleted"}
