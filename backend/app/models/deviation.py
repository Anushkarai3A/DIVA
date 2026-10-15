"""Deviation SQLAlchemy model (mirrors database/schema.sql)."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Deviation(Base):
    __tablename__ = "deviations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    deviation_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    event_date: Mapped[datetime | None] = mapped_column(DateTime)
    reported_date: Mapped[datetime | None] = mapped_column(DateTime)

    department: Mapped[str | None] = mapped_column(String(150))
    site: Mapped[str | None] = mapped_column(String(150))

    product_name: Mapped[str | None] = mapped_column(String(255))
    product_code: Mapped[str | None] = mapped_column(String(100))
    batch_number: Mapped[str | None] = mapped_column(String(100), index=True)
    manufacturing_stage: Mapped[str | None] = mapped_column(String(255))

    process_parameter: Mapped[str | None] = mapped_column(String(255))
    approved_range: Mapped[str | None] = mapped_column(String(255))
    actual_value: Mapped[str | None] = mapped_column(String(100))
    unit: Mapped[str | None] = mapped_column(String(50))
    duration: Mapped[str | None] = mapped_column(String(100))

    equipment: Mapped[str | None] = mapped_column(String(255))
    equipment_id: Mapped[str | None] = mapped_column(String(100))

    immediate_action: Mapped[str | None] = mapped_column(Text)
    potential_impact: Mapped[str | None] = mapped_column(Text)
    root_cause_indication: Mapped[str | None] = mapped_column(Text)

    ai_recommended_severity: Mapped[str | None] = mapped_column(String(50), index=True)
    final_severity: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ai_impact_level: Mapped[str | None] = mapped_column(String(50))
    ai_reason: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String(50), default="Open", index=True)
    source_type: Mapped[str | None] = mapped_column(String(20))
    ai_confidence_avg: Mapped[float | None] = mapped_column(Float)
    created_by: Mapped[str] = mapped_column(String(100), default="ai-demo-user")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    ai_assessments = relationship(
        "AiAssessment",
        back_populates="deviation",
        cascade="all, delete-orphan",
        order_by="AiAssessment.created_at.desc()",
    )
    audit_events = relationship(
        "AuditEvent",
        back_populates="deviation",
        cascade="all, delete-orphan",
        order_by="AuditEvent.created_at.asc()",
    )
