"""
Serialized ingestion queue.

Two simultaneous uploads sharing the same event loop would race on
get_existing_hashes → embed → bulk_insert (both fetch the same hashes
before either commits, then both try to insert duplicates). Running all
ingestion jobs through a single-worker queue eliminates this without
requiring a DB-level unique constraint change.

Usage
-----
    # on startup (main.py)
    await start_ingestion_worker()

    # instead of asyncio.create_task(process_document_background(...))
    await enqueue_ingestion(process_document_background(...))
"""

import asyncio
import logging
from typing import Coroutine, Any

logger = logging.getLogger(__name__)

_queue: asyncio.Queue | None = None
_worker_task: asyncio.Task | None = None


def _get_queue() -> asyncio.Queue:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    return _queue


async def _worker() -> None:
    """Consume coroutines from the queue one at a time."""
    q = _get_queue()
    while True:
        coro: Coroutine[Any, Any, None] = await q.get()
        try:
            await coro
        except Exception as exc:
            logger.error("Ingestion job failed: %s", exc, exc_info=True)
        finally:
            q.task_done()


async def start_ingestion_worker() -> None:
    """Start the background worker. Call once from FastAPI startup."""
    global _worker_task
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_worker(), name="ingestion-worker")
        logger.info("Ingestion worker started")


async def enqueue_ingestion(coro: Coroutine[Any, Any, None]) -> None:
    """Add an ingestion coroutine to the serialized queue."""
    await _get_queue().put(coro)


def queue_size() -> int:
    """Return the number of pending jobs (for health checks)."""
    q = _queue
    return q.qsize() if q else 0
