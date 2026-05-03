import asyncio
import time
from fastapi import APIRouter
from sqlalchemy import text

_start_time = time.time()

router = APIRouter(tags=["health"])


@router.api_route("/ping", methods=["GET", "HEAD"])
async def ping():
    return {"status": "ok", "service": "knowledge-base-api"}


@router.api_route("/health", methods=["GET", "HEAD"])
async def health():
    """
    Detailed health check. Returns:
    - db: connectivity + document/chunk counts
    - cache: Redis reachability + backend name
    - ingestion_queue: pending job count
    - uptime_seconds
    """
    from app.db.client import AsyncSessionLocal
    from app.cache.redis_client import cache_ping, cache_backend
    from app.ingestion.queue import queue_size

    db_result: dict = {"ok": False, "documents": 0, "chunks": 0, "error": None}
    cache_result: dict = {"ok": False, "backend": cache_backend()}

    async def _check_db():
        try:
            async with AsyncSessionLocal() as db:
                doc_row = await db.execute(
                    text("SELECT COUNT(*) FROM documents WHERE status = 'done'")
                )
                chunk_row = await db.execute(text("SELECT COUNT(*) FROM chunks"))
            db_result["ok"] = True
            db_result["documents"] = int(doc_row.scalar() or 0)
            db_result["chunks"] = int(chunk_row.scalar() or 0)
        except Exception as exc:
            db_result["error"] = str(exc)[:200]

    async def _check_cache():
        cache_result["ok"] = await cache_ping()

    await asyncio.gather(_check_db(), _check_cache())

    return {
        "status": "healthy" if db_result["ok"] else "degraded",
        "uptime_seconds": round(time.time() - _start_time),
        "db": db_result,
        "cache": cache_result,
        "ingestion_queue": {"pending_jobs": queue_size()},
    }
