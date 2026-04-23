def reciprocal_rank_fusion(vector_results, bm25_results, k=60, top_n=8) -> list[dict]:
    scores: dict[str, float] = {}
    chunk_data: dict[str, dict] = {}

    for result in vector_results:
        cid = result["id"]
        scores[cid] = scores.get(cid, 0) + 1 / (k + result["rank"])
        chunk_data[cid] = result

    for result in bm25_results:
        cid = result["id"]
        scores[cid] = scores.get(cid, 0) + 1 / (k + result["rank"])
        if cid not in chunk_data:
            chunk_data[cid] = result

    sorted_ids = sorted(scores, key=lambda cid: scores[cid], reverse=True)
    results = []
    for cid in sorted_ids[:top_n]:
        chunk = chunk_data[cid].copy()
        chunk["rrf_score"] = round(scores[cid], 6)
        results.append(chunk)
    return results
