"""Database engine — SQLite (asyncpg kaldırıldı, ADR-005).

Phase 1: SQLite async engine.
Phase 4: SQLCipher entegrasyonu (Rust Agent).
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from core.config.settings import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    """Phase 1: Boş şema. Phase 2'de modeller eklenecek."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
