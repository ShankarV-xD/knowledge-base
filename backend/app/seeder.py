"""
Seeds the shared demo user's account with a small set of markdown
documents about Shankar so portfolio visitors land in a chat-ready
state instead of an empty workspace.

Idempotent: if the demo user already has all three documents in 'done'
status, this is a no-op. Anything missing or in a failed state is
re-ingested.
"""

import logging
import os
from pathlib import Path

from app.config import settings
from app.db import crud
from app.db.client import AsyncSessionLocal
from app.db.models import Document
from app.ingestion.pipeline import process_document_background
from app.ingestion.queue import enqueue_ingestion
from sqlalchemy import select

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parent.parent / "seed_data"


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


async def seed_demo_documents_if_needed() -> None:
    """Ensure the demo user has the seed markdown documents ingested."""
    if not settings.enable_demo_login:
        return
    if not SEED_DIR.is_dir():
        logger.warning("Seeder: seed_data directory not found at %s", SEED_DIR)
        return

    seed_files = sorted(SEED_DIR.glob("*.md"))
    if not seed_files:
        logger.info("Seeder: no .md files in seed_data, skipping")
        return

    async with AsyncSessionLocal() as db:
        user_id = await _get_or_create_demo_user(db)
        existing = await _existing_done_titles(db, user_id)

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

            await enqueue_ingestion(
                process_document_background(
                    str(doc.id), file_bytes, path.name,
                    "markdown", title, user_id,
                )
            )
            logger.info("Seeder: queued %s for demo user", title)
