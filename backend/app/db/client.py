import ssl
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.config import settings


def _ssl_connect_arg() -> dict:
    """Return an SSL context that encrypts but skips cert verification.
    Required for Supabase's PgBouncer which uses a self-signed chain."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return {"ssl": ctx}


def _build_db_url(raw: str) -> tuple[str, bool]:
    """Convert any postgres:// URL to postgresql+asyncpg://, strip libpq-only
    params (sslmode, prepared_statements) that asyncpg doesn't accept, and
    return (clean_url, needs_ssl)."""
    url = raw.replace("postgresql://", "postgresql+asyncpg://").replace(
        "postgres://", "postgresql+asyncpg://"
    )
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = params.pop("sslmode", ["disable"])[0]
    params.pop("prepared_statements", None)
    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean = urlunparse(parsed._replace(query=new_query))
    needs_ssl = sslmode in ("require", "verify-ca", "verify-full")
    return clean, needs_ssl


_db_url, _ssl = _build_db_url(settings.database_url)

# For Supabase PgBouncer (transaction pooler, port 6543):
# - NullPool: don't pool on our side, PgBouncer does it
# - prepared_statement_name_func: use empty string to tell SQLAlchemy's
#   asyncpg adapter to use unnamed prepared statements (PgBouncer compatible)
# - statement_cache_size=0: disable asyncpg's own statement cache
engine = create_async_engine(
    _db_url,
    echo=False,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "server_settings": {"jit": "off"},
        "prepared_statement_name_func": lambda: "",
        **(_ssl_connect_arg() if _ssl else {}),
    },
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
