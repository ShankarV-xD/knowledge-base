import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.retrieval.vector_search import vector_search
from app.retrieval.bm25_search import bm25_search
from app.retrieval.rrf import reciprocal_rank_fusion
from app.retrieval.expander import expand_query
from app.ingestion.embedder import embed_queries_batch


async def retrieve(db, user_id, query, top_n=6,
                   source_type=None, days=None, gemini_api_key=None) -> list[dict]:
    query_variants = await expand_query(query, gemini_api_key)
    # One API call for all variants instead of N parallel calls
    embeddings = await embed_queries_batch(query_variants, gemini_api_key)

    vector_tasks = [
        vector_search(db, user_id, emb, limit=15, source_type=source_type, days=days)
        for emb in embeddings
    ]
    all_vector_lists = await asyncio.gather(*vector_tasks)

    seen: dict[str, int] = {}
    flat_vector = []
    rank_counter = 1
    for results_list in all_vector_lists:
        for result in results_list:
            cid = result["id"]
            if cid not in seen:
                seen[cid] = rank_counter
                result["rank"] = rank_counter
                flat_vector.append(result)
                rank_counter += 1

    bm25_results = await bm25_search(db, user_id, query, limit=20,
                                      source_type=source_type, days=days)
    return reciprocal_rank_fusion(flat_vector, bm25_results, top_n=top_n)
