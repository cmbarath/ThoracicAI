"""Database engine and session management."""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ..config import settings
from ..models import Base

connect_args = {}
engine_kwargs = {}

db_url = settings.EFFECTIVE_DATABASE_URL

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    # If in-memory or file SQLite
    if ":memory:" in db_url:
        engine_kwargs["poolclass"] = StaticPool
else:
    # PostgreSQL (Supabase) pooling settings
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
