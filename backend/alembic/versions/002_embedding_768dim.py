"""Reduce embedding dimension from 3072 → 768 for pgvector index support

Revision ID: 002
Revises: 001
Create Date: 2026-04-19

Changes:
- Drops and re-adds chunks.embedding as vector(768)
- Clears all existing embeddings (they were 3072-dim, incompatible)
- Resets all documents to 'pending' so the ingestion queue re-embeds them
- Creates HNSW index (now possible since 768 ≤ 2000 dim limit)

After running this migration, restart the server — the ingestion worker
will automatically re-process all pending documents.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old 3072-dim column and recreate as 768-dim
    op.execute("ALTER TABLE chunks DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE chunks ADD COLUMN embedding vector(768)")

    # Drop any stale indexes
    op.execute("DROP INDEX IF EXISTS chunks_embedding_idx")
    op.execute("DROP INDEX IF EXISTS chunks_embedding_hnsw_idx")
    op.execute("DROP INDEX IF EXISTS chunks_embedding_ivfflat_idx")

    # Create HNSW index (now within the 2000-dim limit)
    op.execute("""
        CREATE INDEX chunks_embedding_hnsw_idx
        ON chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # Reset all documents so the ingestion queue re-embeds them at 768 dims
    op.execute("""
        UPDATE documents
        SET status = 'pending', error_message = NULL
        WHERE status IN ('done', 'error')
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS chunks_embedding_hnsw_idx")
    op.execute("ALTER TABLE chunks DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE chunks ADD COLUMN embedding vector(3072)")
    op.execute("""
        UPDATE documents SET status = 'pending', error_message = NULL
        WHERE status IN ('done', 'error')
    """)
