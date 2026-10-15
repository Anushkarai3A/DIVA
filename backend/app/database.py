"""PostgreSQL / SQLAlchemy configuration (sync engine)."""
import logging
import time

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

logger = logging.getLogger("diva.database")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency yielding a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(retries: int = 5, delay: float = 2.0) -> None:
    """Create tables, retrying while PostgreSQL is still starting up."""
    # Import models so they are registered on Base.metadata before create_all.
    from app import models  # noqa: F401

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database schema verified (attempt %s)", attempt)
            return
        except Exception as exc:  # pragma: no cover - startup only
            last_error = exc
            logger.warning(
                "Database not ready (attempt %s/%s): %s", attempt, retries, exc
            )
            time.sleep(delay)
    raise RuntimeError(f"Could not connect to database: {last_error}")
