import json
from typing import Optional

# In-memory fallback when Redis is not configured
_memory_cache: dict[str, str] = {}

try:
    from upstash_redis import Redis
    from app.config import settings
    _redis = Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token,
    ) if settings.upstash_redis_rest_url else None
except Exception:
    _redis = None


async def cache_get(key: str) -> Optional[str]:
    if _redis:
        try:
            val = _redis.get(key)
            if val is not None:
                return val if isinstance(val, str) else val.decode()
        except Exception:
            pass
    return _memory_cache.get(key)


async def cache_set(key: str, value: str, ttl_seconds: int = 86400) -> None:
    if _redis:
        try:
            _redis.set(key, value, ex=ttl_seconds)
            return
        except Exception:
            pass
    # Memory fallback: respect a crude max size to avoid unbounded growth
    if len(_memory_cache) > 5000:
        # Evict ~10% at random
        keys_to_drop = list(_memory_cache.keys())[:500]
        for k in keys_to_drop:
            _memory_cache.pop(k, None)
    _memory_cache[key] = value


async def cache_ping() -> bool:
    """Return True if Redis is reachable, False if using memory fallback."""
    if _redis:
        try:
            _redis.ping()
            return True
        except Exception:
            pass
    return False


def cache_backend() -> str:
    return "upstash_redis" if _redis else "memory"
