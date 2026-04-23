from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional


async def vector_search(db, user_id, query_embedding, limit=20,
                         source_type=None, days=None) -> list[dict]:
    filters = ["c.user_id = :user_id", "c.embedding IS NOT NULL",
               "1 - (c.embedding <=> CAST(:embedding AS vector)) > 0.55"]
    params = {"user_id": user_id, "embedding": str(query_embedding), "limit": limit}

    if source_type:
        filters.append("d.source_type = :source_type")
        params["source_type"] = source_type

    if days:
        filters.append("c.created_at >= NOW() - make_interval(days => :days)")
        params["days"] = days

    where = " AND ".join(filters)
    sql = text(f"""
        SELECT c.id::text AS id, c.content, c.heading, c.source_title, c.source_path,
               c.page_number, c.chunk_index,
               1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE {where}
        ORDER BY c.embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
    """)

    # Widen the HNSW beam for better recall without changing the index
    await db.execute(text("SET LOCAL hnsw.ef_search = 60"))
    result = await db.execute(sql, params)
    return [
        {"id": row.id, "content": row.content, "heading": row.heading,
         "source_title": row.source_title, "source_path": row.source_path,
         "page_number": row.page_number, "score": float(row.score), "rank": i + 1}
        for i, row in enumerate(result.fetchall())
    ]
