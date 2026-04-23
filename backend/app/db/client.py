from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.config import settings

db_url = settings.database_url.replace(
    "postgresql://", "postgresql+asyncpg://"
).replace("postgres://", "postgresql+asyncpg://")

# For Supabase PgBouncer (transaction pooler, port 6543):
# - NullPool: don't pool on our side, PgBouncer does it
# - prepared_statement_name_func: use empty string to tell SQLAlchemy's
#   asyncpg adapter to use unnamed prepared statements (PgBouncer compatible)
# - statement_cache_size=0: disable asyncpg's own statement cache
engine = create_async_engine(
    db_url,
    echo=False,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "server_settings": {"jit": "off"},
        "prepared_statement_name_func": lambda: "",
    },
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
