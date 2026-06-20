import asyncio
import hashlib
import json
from typing import Optional
import google.generativeai as genai
from app.cache.redis_client import cache_get, cache_set
from app.ingestion.chunker import RawChunk

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIM = 768   # truncate 3072-dim output to first 768 (Matryoshka property)
BATCH_SIZE = 100      # Gemini supports up to 100 per batch call
_CACHE_VERSION = "v2"  # bump when model/dim changes to avoid stale cache hits


def _query_cache_key(text: str) -> str:
    return f"emb_q:{_CACHE_VERSION}:{hashlib.sha256(text.encode()).hexdigest()[:24]}"


async def embed_single(text: str, gemini_api_key: str) -> list[float]:
    """Embed a single query string. Results are cached for 1 hour."""
    if not gemini_api_key:
        raise ValueError("Gemini API key required for embeddings")
    genai.configure(api_key=gemini_api_key)

    cache_key = _query_cache_key(text)
    cached = await cache_get(cache_key)
    if cached:
        return json.loads(cached)

    def _call():
        result = genai.embed_content(
            model=EMBEDDING_MODEL, content=text, task_type="retrieval_query",
        )
        return result["embedding"][:EMBEDDING_DIM]

    embedding = await asyncio.get_event_loop().run_in_executor(None, _call)
    await cache_set(cache_key, json.dumps(embedding), ttl_seconds=3600)
    return embedding


async def embed_queries_batch(texts: list[str], gemini_api_key: str) -> list[list[float]]:
    """
    Embed multiple query strings in a single API call (one round-trip instead of N).
    Falls back to individual calls with asyncio.gather if the batch call fails.
    Results are cached per-query for 1 hour.
    """
    if not texts:
        return []

    if not gemini_api_key:
        raise ValueError("Gemini API key required for embeddings")
    genai.configure(api_key=gemini_api_key)

    # Check cache for each text first
    results: list[Optional[list[float]]] = [None] * len(texts)
    uncached_indices: list[int] = []
    uncached_texts: list[str] = []

    for i, text in enumerate(texts):
        cached = await cache_get(_query_cache_key(text))
        if cached:
            results[i] = json.loads(cached)
        else:
            uncached_indices.append(i)
            uncached_texts.append(text)

    if not uncached_texts:
        return results  # type: ignore[return-value]

    def _batch_call(batch: list[str]) -> list[list[float]]:
        result = genai.embed_content(
            model=EMBEDDING_MODEL, content=batch, task_type="retrieval_query",
        )
        embs = result["embedding"]
        # Gemini returns a single list when content is a list — always list-of-lists
        embs = embs if isinstance(embs[0], list) else [embs]
        return [e[:EMBEDDING_DIM] for e in embs]

    try:
        new_embeddings: list[list[float]] = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _batch_call(uncached_texts)
        )
    except Exception:
        # Fallback: embed individually in parallel
        new_embeddings = list(await asyncio.gather(*[embed_single(t, gemini_api_key) for t in uncached_texts]))

    for local_i, (global_i, embedding) in enumerate(zip(uncached_indices, new_embeddings)):
        results[global_i] = embedding
        await cache_set(_query_cache_key(uncached_texts[local_i]), json.dumps(embedding), ttl_seconds=3600)

    return results  # type: ignore[return-value]


async def embed_chunks(chunks: list[RawChunk], gemini_api_key: str) -> list[Optional[list[float]]]:
    """
    Embed document chunks in batches of up to BATCH_SIZE.
    Results are cached by content_hash for 7 days.
    """
    if not gemini_api_key:
        raise ValueError("Gemini API key required for embeddings")
    genai.configure(api_key=gemini_api_key)
    embeddings: list[Optional[list[float]]] = [None] * len(chunks)
    uncached_indices: list[int] = []
    uncached_texts: list[str] = []

    for i, chunk in enumerate(chunks):
        cache_key = f"emb:{_CACHE_VERSION}:{chunk.content_hash}"
        cached = await cache_get(cache_key)
        if cached:
            embeddings[i] = json.loads(cached)
        else:
            uncached_indices.append(i)
            uncached_texts.append(chunk.content)

    if not uncached_texts:
        return embeddings

    def _batch_embed(texts_batch: list[str]) -> list[list[float]]:
        result = genai.embed_content(
            model=EMBEDDING_MODEL, content=texts_batch, task_type="retrieval_document",
        )
        embs = result["embedding"]
        embs = embs if isinstance(embs[0], list) else [embs]
        return [e[:EMBEDDING_DIM] for e in embs]

    all_new: list[list[float]] = []
    for start in range(0, len(uncached_texts), BATCH_SIZE):
        batch = uncached_texts[start : start + BATCH_SIZE]
        batch_embs = await asyncio.get_event_loop().run_in_executor(
            None, lambda b=batch: _batch_embed(b)
        )
        all_new.extend(batch_embs)
        # Only sleep between batches (not after the last one)
        if start + BATCH_SIZE < len(uncached_texts):
            await asyncio.sleep(0.3)

    for local_idx, (global_idx, embedding) in enumerate(zip(uncached_indices, all_new)):
        embeddings[global_idx] = embedding
        await cache_set(
            f"emb:{_CACHE_VERSION}:{chunks[global_idx].content_hash}",
            json.dumps(embedding),
            ttl_seconds=604800,  # 7 days
        )

    return embeddings
