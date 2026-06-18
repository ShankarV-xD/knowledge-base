"""
Idempotent schema setup: run on every startup.

Creates:
  - users table (if not exists)
  - Vector index on chunks.embedding when dimension ≤ 2000
    (pgvector HNSW/IVFFlat both cap at 2000 dims)

Note: gemini-embedding-001 outputs 3072-dim vectors, but they are truncated to
768 dims (Matryoshka property), so the embedding column is vector(768) and the
HNSW cosine index is created and used. The exact-scan fallback below only
applies if a deployment runs embeddings above pgvector's 2000-dim index limit.
"""

import logging
from sqlalchemy import text
from app.db.client import engine

logger = logging.getLogger(__name__)


async def ensure_schema() -> None:
    async with engine.begin() as conn:
        # ── users table ───────────────────────────────────────────────────────
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        # ── share_token column on conversations (idempotent) ──────────────────
        await conn.execute(text("""
            ALTER TABLE conversations
            ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS conversations_share_token_idx
            ON conversations (share_token) WHERE share_token IS NOT NULL
        """))

        # ── detect embedding dimension ────────────────────────────────────────
        dim_row = await conn.execute(text("""
            SELECT atttypmod
            FROM pg_attribute
            JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
            WHERE pg_class.relname = 'chunks'
              AND pg_attribute.attname = 'embedding'
              AND pg_attribute.attnum > 0
        """))
        row = dim_row.fetchone()
        dim = row[0] if row else -1

        # Drop legacy index names from old schema versions
        await conn.execute(text("DROP INDEX IF EXISTS chunks_embedding_idx"))

        if 0 < dim <= 2000:
            # ── HNSW index (preferred) ────────────────────────────────────────
            try:
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
                    ON chunks USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64)
                """))
                logger.info("Database schema ready — HNSW index active (dim=%d)", dim)
            except Exception as e:
                logger.info("Database schema ready — exact scan active (dim=%d, index skipped: %s)", dim, e)
        else:
            # Dimension exceeds pgvector index limit — exact scan is used automatically
            logger.info(
                "Database schema ready — exact scan active "
                "(embedding dim=%d exceeds pgvector's 2000-dim index limit; "
                "performance is fine for personal-scale use)",
                dim,
            )
