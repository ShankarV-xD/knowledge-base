"""Initialize database tables."""
import asyncio
from sqlalchemy import text
from app.db.client import engine
from app.db.models import Base


async def init_db():
    async with engine.begin() as conn:
        print("Enabling pgvector extension...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created successfully!")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
