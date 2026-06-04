import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import health, upload, chat, documents, digest, share
from app.api import auth as auth_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Personal Knowledge Base API",
    version="1.0.0",
    description="Chat with your notes — Obsidian, Notion, PDF, Markdown",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-Gemini-Key"],
    expose_headers=["X-Conversation-Id"],
)

app.include_router(auth_router.router)
app.include_router(health.router)
app.include_router(upload.router)
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(digest.router)
app.include_router(share.router)


def _validate_settings() -> None:
    """Warn loudly about dangerous or missing configuration."""
    warnings = []
    if len(settings.auth_secret) < 32:
        warnings.append(
            f"AUTH_SECRET is only {len(settings.auth_secret)} chars — "
            "must be ≥32 random bytes in production. Set AUTH_SECRET in .env"
        )
    if settings.auth_secret.startswith("changeme"):
        warnings.append("AUTH_SECRET is still the default placeholder — change it before deploying!")
    if not settings.gemini_api_key:
        warnings.append("GEMINI_API_KEY is not set — chat will not work")
    if not settings.database_url:
        warnings.append("DATABASE_URL is not set — database connections will fail")
    for w in warnings:
        logger.warning("⚠️  CONFIG: %s", w)


@app.on_event("startup")
async def startup():
    _validate_settings()
    logger.info("Knowledge Base API starting up...")

    # DB-dependent operations are wrapped individually so a paused/unreachable
    # database can't crash the whole app. /health will report 'degraded' and
    # UptimeRobot pings still keep Render warm; once the DB is reachable again
    # subsequent requests recover automatically.

    from app.db.client import AsyncSessionLocal
    from app.db.crud import reset_stuck_documents
    try:
        async with AsyncSessionLocal() as db:
            await reset_stuck_documents(db)
    except Exception as e:
        logger.warning("Startup: reset_stuck_documents skipped (DB unreachable): %s", e)

    # Ingestion worker is in-process only, no DB calls — safe to run unconditionally
    from app.ingestion.queue import start_ingestion_worker
    await start_ingestion_worker()

    from app.db.ensure_indexes import ensure_schema
    try:
        await ensure_schema()
    except Exception as e:
        logger.warning("Startup: ensure_schema skipped (DB unreachable): %s", e)


@app.on_event("shutdown")
async def shutdown():
    from app.db.client import engine
    await engine.dispose()
