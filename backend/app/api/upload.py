import os
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.client import get_db
from app.db import crud
from app.ingestion.pipeline import detect_source_type, process_document_background, process_url_background
from app.ingestion.queue import enqueue_ingestion
from app.auth.dependency import get_current_user
from app.config import settings, resolve_gemini_key
from app.storage import supabase_storage

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    gemini_key = resolve_gemini_key(request.headers.get("x-gemini-key"))
    if not gemini_key:
        raise HTTPException(400, "Add your Gemini API key before uploading.")

    file_bytes = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(413, f"File exceeds {settings.max_upload_size_mb}MB limit")

    source_type = await detect_source_type(file.filename, file.content_type or "")
    doc_title = Path(file.filename).stem

    file_id = uuid.uuid4()
    safe_name = Path(file.filename).name
    if supabase_storage.is_configured():
        try:
            stored_ref = await supabase_storage.upload_bytes(
                f"{current_user_id}/{file_id}_{safe_name}",
                file_bytes,
                file.content_type or "application/octet-stream",
            )
        except Exception as e:
            print(f"[upload] Supabase Storage upload failed: {e}")
            raise HTTPException(502, "Failed to store file in Supabase Storage")
    else:
        os.makedirs(settings.upload_dir, exist_ok=True)
        saved_path = os.path.join(settings.upload_dir, f"{file_id}_{safe_name}")
        with open(saved_path, "wb") as f:
            f.write(file_bytes)
        stored_ref = saved_path

    doc = await crud.create_document(
        db, user_id=current_user_id, title=doc_title,
        source_type=source_type, file_path=stored_ref,
    )

    await enqueue_ingestion(
        process_document_background(
            str(doc.id), file_bytes, file.filename,
            source_type, doc_title, current_user_id, gemini_key,
        )
    )

    return {
        "document_id": str(doc.id),
        "title": doc_title,
        "source_type": source_type,
        "status": "processing",
    }


class UrlImportRequest(BaseModel):
    url: str


@router.post("/url")
async def import_url(
    req: UrlImportRequest,
    request: Request,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    gemini_key = resolve_gemini_key(request.headers.get("x-gemini-key"))
    if not gemini_key:
        raise HTTPException(400, "Add your Gemini API key before uploading.")

    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")

    import httpx
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch URL: {str(e)}")

    content_type = resp.headers.get("content-type", "")
    if "html" not in content_type and "text" not in content_type:
        raise HTTPException(400, "URL must point to an HTML or text page")

    html_content = resp.text
    title_match = re.search(r"<title[^>]*>([^<]+)</title>", html_content, re.IGNORECASE)
    domain = urlparse(url).netloc.replace("www.", "")
    doc_title = (title_match.group(1).strip()[:120] if title_match else domain) or domain

    doc = await crud.create_document(
        db, user_id=current_user_id, title=doc_title,
        source_type="markdown", file_path=url,
    )

    await enqueue_ingestion(
        process_url_background(str(doc.id), url, html_content, doc_title, current_user_id, gemini_key)
    )

    return {
        "document_id": str(doc.id),
        "title": doc_title,
        "source_type": "markdown",
        "status": "processing",
    }
