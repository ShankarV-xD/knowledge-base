"""
Simple in-memory rate limiter — no extra dependencies.
Uses a sliding-window algorithm. Not suitable for multi-process
deployments (use Redis in production), but fine for a single-process uvicorn server.
"""
import time
from collections import defaultdict
from threading import Lock
from fastapi import HTTPException

_store: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def check_rate_limit(key: str, max_requests: int, window_seconds: int = 60) -> None:
    """
    Raises HTTP 429 if `key` has exceeded `max_requests` in the last `window_seconds`.
    Call this at the top of any endpoint handler that needs throttling.
    """
    now = time.time()
    cutoff = now - window_seconds

    with _lock:
        times = _store[key]
        # Drop timestamps outside the window
        times[:] = [t for t in times if t > cutoff]
        if len(times) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: max {max_requests} requests per {window_seconds}s. Please wait.",
            )
        times.append(now)
