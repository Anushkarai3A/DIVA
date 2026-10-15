"""Audit trail events — one row per meaningful mutation."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

JSONType = JSON().with_variant(JSONB, "postgresql")

EVENT_TYPES = (
    "created",
    "ai_extracted",
    "field_edited",
    "ai_refinement_applied",
    "ai_refinement_rejected",
    "severity_overridden",
    "updated",
)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    deviation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deviations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor: Mapped[str] = mapped_column(String(100), default="ai-demo-user")
    details: Mapped[dict | None] = mapped_column(JSONType)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )

    deviation = relationship("Deviation", back_populates="audit_events")
