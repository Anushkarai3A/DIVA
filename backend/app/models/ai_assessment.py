"""AI assessment runs — structured AI output stored as JSONB (relational on PG)."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# JSONB on PostgreSQL, portable JSON elsewhere (SQLite tests).
JSONType = JSON().with_variant(JSONB, "postgresql")


class AiAssessment(Base):
    __tablename__ = "ai_assessments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    deviation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deviations.id", ondelete="CASCADE"), nullable=False, index=True
    )

    provider: Mapped[str] = mapped_column(String(20), nullable=False, default="demo")
    model: Mapped[str] = mapped_column(String(100), default="")

    extraction: Mapped[dict | None] = mapped_column(JSONType)
    confidence: Mapped[dict | None] = mapped_column(JSONType)
    evidence: Mapped[dict | None] = mapped_column(JSONType)
    validation: Mapped[dict | None] = mapped_column(JSONType)
    impact: Mapped[dict | None] = mapped_column(JSONType)
    severity: Mapped[dict | None] = mapped_column(JSONType)
    explanation: Mapped[str | None] = mapped_column(Text)
    raw_text_excerpt: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    deviation = relationship("Deviation", back_populates="ai_assessments")
