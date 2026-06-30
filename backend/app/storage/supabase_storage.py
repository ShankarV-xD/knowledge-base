"""Supabase Storage helper.

Persists uploaded files in a Supabase Storage bucket so originals survive
container restarts/redeploys (the local ./uploads dir is ephemeral on free-tier
hosts). Uses the Storage REST API with the service key, so the bucket can stay
private. When Supabase is not configured the caller falls back to local disk.

file_path values stored in the DB:
  - "http(s)://..."        -> a URL import
  - "storage://<key>"      -> an object in the Supabase bucket
  - anything else          -> a legacy local-disk path
"""
from urllib.parse import quote

import httpx

from app.config import settings

STORAGE_PREFIX = "storage://"


def is_configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_key)


def is_storage_ref(file_path: str | None) -> bool:
    return bool(file_path) and file_path.startswith(STORAGE_PREFIX)


def object_key(ref: str) -> str:
    """Strip the storage:// prefix to get the bucket object key."""
    return ref[len(STORAGE_PREFIX):] if ref.startswith(STORAGE_PREFIX) else ref


def _validate_key(key: str) -> None:
    """Reject keys that could escape the bucket namespace. Current callers build
    keys server-side, but this guards against any future less-sanitized caller."""
    if "\\" in key or any(part in ("", "..") for part in key.split("/")):
        raise ValueError("invalid storage object key")


def _object_url(key: str) -> str:
    _validate_key(key)
    base = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_storage_bucket
    return f"{base}/storage/v1/object/{bucket}/{quote(key, safe='/')}"


def _headers(content_type: str | None = None) -> dict:
    h = {
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "apikey": settings.supabase_service_key,
    }
    if content_type:
        h["Content-Type"] = content_type
    return h


async def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to the bucket under `key`. Returns the storage:// reference."""
    headers = _headers(content_type)
    headers["x-upsert"] = "true"
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(_object_url(key), content=data, headers=headers)
        resp.raise_for_status()
    return f"{STORAGE_PREFIX}{key}"


async def download_bytes(ref: str) -> bytes:
    """Download an object given a storage:// reference (or bare key)."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(_object_url(object_key(ref)), headers=_headers())
        resp.raise_for_status()
        return resp.content


async def delete_object(ref: str) -> None:
    """Best-effort delete; ignores a missing object."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(_object_url(object_key(ref)), headers=_headers())
        if resp.status_code not in (200, 404):
            resp.raise_for_status()
