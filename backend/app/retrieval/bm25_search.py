from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional


async def bm25_search(db, user_id, query, limit=20,
                       source_type=None, days=None) -> list[dict]:
    filters = ["c.user_id = :user_id",
               "c.search_vector @@ plainto_tsquery('english', :query)"]
    params = {"user_id": user_id, "query": query, "limit": limit}

    if source_type:
        filters.append("d.source_type = :source_type")
        params["source_type"] = source_type

    if days:
        filters.append("c.created_at >= NOW() - make_interval(days => :days)")
        params["days"] = days

    where = " AND ".join(filters)
    sql = text(f"""
        SELECT CAST(c.id AS text) AS id, c.content, c.heading, c.source_title,
               c.source_path, c.page_number, c.chunk_index,
               ts_rank_cd(c.search_vector, plainto_tsquery('english', :query)) AS score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE {where}
        ORDER BY score DESC
        LIMIT :limit
    """)

    result = await db.execute(sql, params)
    return [
        {"id": row.id, "content": row.content, "heading": row.heading,
         "source_title": row.source_title, "source_path": row.source_path,
         "page_number": row.page_number, "score": float(row.score), "rank": i + 1}
        for i, row in enumerate(result.fetchall())
    ]
