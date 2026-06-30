"""
Seeds the shared demo user's account with a small set of markdown
documents about Shankar so portfolio visitors land in a chat-ready
state instead of an empty workspace.

Idempotent: if the demo user already has all three documents in 'done'
status, this is a no-op. Anything missing or in a failed state is
re-ingested.
"""

import json
import logging
import os
import uuid
from pathlib import Path

from app.config import settings
from app.db import crud
from app.db.client import AsyncSessionLocal
from app.db.models import Document
from app.ingestion.chunker import RawChunk
from app.ingestion.pipeline import process_document_background
from app.ingestion.queue import enqueue_ingestion
from sqlalchemy import select

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parent.parent / "seed_data"
FIXTURE_PATH = SEED_DIR / "seed_embeddings.json"


async def _get_or_create_demo_user(db) -> str:
    import bcrypt
    import secrets

    email = settings.demo_email.strip().lower()
    user = await crud.get_user_by_email(db, email)
    if user:
        return str(user.id)
    random_password = secrets.token_urlsafe(32)
    password_hash = bcrypt.hashpw(random_password.encode(), bcrypt.gensalt()).decode()
    user = await crud.create_user(db, email, password_hash)
    logger.info("Seeder: created demo user %s", email)
    return str(user.id)


async def _existing_done_titles(db, user_id: str) -> set[str]:
    result = await db.execute(
        select(Document.title).where(
            Document.user_id == user_id,
            Document.status == "done",
        )
    )
    return {row[0] for row in result.all()}


async def _seed_from_fixture(db, user_id: str, existing: set[str]) -> None:
    """Load precomputed chunk embeddings (seed_embeddings.json) directly into the
    DB. No Gemini key needed at runtime — vectors were generated once offline."""
    data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    for doc_entry in data.get("documents", []):
        title = doc_entry["title"]
        if title in existing:
            continue
        doc = await crud.create_document(
            db, user_id=user_id, title=title,
            source_type=doc_entry.get("source_type", "markdown"), file_path=None,
        )
        chunk_rows = []
        for ch in doc_entry.get("chunks", []):
            if not ch.get("embedding"):
                continue
            rc = RawChunk(
                content=ch["content"], heading=ch.get("heading", ""),
                source_title=ch.get("source_title", title), source_path=ch.get("source_path", ""),
                chunk_index=ch["chunk_index"], page_number=ch.get("page_number"),
            )
            chunk_rows.append({
                "id": uuid.uuid4(),
                "document_id": doc.id,
                "user_id": user_id,
                "content": rc.content,
                "content_hash": rc.content_hash,
                "heading": rc.heading,
                "source_title": rc.source_title,
                "source_path": rc.source_path,
                "chunk_index": rc.chunk_index,
                "token_count": rc.token_count,
                "page_number": rc.page_number,
                "embedding": ch["embedding"],
            })
        await crud.bulk_insert_chunks(db, chunk_rows)
        await crud.update_document_status(
            db, str(doc.id), "done",
            chunk_count=len(chunk_rows),
            token_count=sum(r["token_count"] for r in chunk_rows),
        )
        logger.info("Seeder: loaded %s from fixture (%d chunks)", title, len(chunk_rows))


async def seed_demo_documents_if_needed() -> None:
    """Ensure the demo user has the seed markdown documents ingested."""
    if not settings.enable_demo_login:
        return
    if not SEED_DIR.is_dir():
        logger.warning("Seeder: seed_data directory not found at %s", SEED_DIR)
        return

    seed_files = sorted(SEED_DIR.glob("*.md"))
    if not seed_files and not FIXTURE_PATH.exists():
        logger.info("Seeder: no seed data, skipping")
        return

    async with AsyncSessionLocal() as db:
        user_id = await _get_or_create_demo_user(db)
        existing = await _existing_done_titles(db, user_id)

        # Preferred: load precomputed embeddings, no Gemini key required.
        if FIXTURE_PATH.exists():
            await _seed_from_fixture(db, user_id, existing)
            return

        # Fallback: embed at startup with the server key (if one is set).
        for path in seed_files:
            title = path.stem
            if title in existing:
                continue

            file_bytes = path.read_bytes()
            doc = await crud.create_document(
                db,
                user_id=user_id,
                title=title,
                source_type="markdown",
                file_path=None,
            )

            # Demo seeding is the one ingestion path with no per-user request.
            # It uses settings.gemini_api_key if the owner set one; in a pure
            # no-server-key deploy this is empty and embedding is skipped — the
            # seed document lands in error state, which is acceptable.
            if not settings.gemini_api_key:
                logger.info("Seeder: skipping %s (no server Gemini key for demo seeding)", title)
                continue

            await enqueue_ingestion(
                process_document_background(
                    str(doc.id), file_bytes, path.name,
                    "markdown", title, user_id, settings.gemini_api_key,
                )
            )
            logger.info("Seeder: queued %s for demo user", title)
