"""Deviation persistence: CRUD, deviation-number allocation, audit events."""
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError, NotFound
from app.models import AiAssessment, AuditEvent, Deviation
from app.schemas.deviation import DeviationCreate, DeviationUpdate

logger = logging.getLogger("diva.deviations")

DEFAULT_ACTOR = "ai-demo-user"


def _generate_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"DEV-{year}-"
    count = (
        db.query(func.count(Deviation.id))
        .filter(Deviation.deviation_number.like(f"{prefix}%"))
        .scalar()
        or 0
    )
    return f"{prefix}{int(count) + 1:04d}"


def create_deviation(db: Session, payload: DeviationCreate) -> Deviation:
    data = payload.model_dump(exclude={"ai_assessment"}, exclude_none=False)
    assessment = payload.ai_assessment

    if assessment is not None:
        if assessment.severity is not None and not data.get("ai_recommended_severity"):
            data["ai_recommended_severity"] = assessment.severity.recommended_severity
            data["ai_reason"] = assessment.severity.reason
        if assessment.impact is not None and not data.get("ai_impact_level"):
            data["ai_impact_level"] = assessment.impact.impact_level
        if data.get("ai_confidence_avg") is None and assessment.extraction is not None:
            data["ai_confidence_avg"] = assessment.extraction.average_confidence()

    deviation: Deviation | None = None
    for _ in range(5):
        candidate = Deviation(**data, deviation_number=_generate_number(db))
        db.add(candidate)
        try:
            db.flush()
            deviation = candidate
            break
        except IntegrityError:
            db.rollback()
            logger.warning("deviation_number conflict, retrying allocation")
    if deviation is None:
        raise AppError(
            "Could not allocate a deviation number. Please retry.",
            status_code=500,
            code="number_conflict",
        )

    if assessment is not None:
        extraction = assessment.extraction
        db.add(
            AiAssessment(
                deviation_id=deviation.id,
                provider=assessment.provider,
                model=assessment.model,
                extraction=extraction.data.model_dump() if extraction else None,
                confidence=extraction.confidence if extraction else None,
                evidence=extraction.evidence if extraction else None,
                validation=assessment.validation.model_dump() if assessment.validation else None,
                impact=assessment.impact.model_dump() if assessment.impact else None,
                severity=assessment.severity.model_dump() if assessment.severity else None,
                explanation=assessment.explanation,
                raw_text_excerpt=assessment.raw_text_excerpt,
            )
        )
        db.add(
            AuditEvent(
                deviation_id=deviation.id,
                event_type="ai_extracted",
                actor=DEFAULT_ACTOR,
                details={
                    "provider": assessment.provider,
                    "model": assessment.model,
                    "fields_extracted": sum(
                        1
                        for v in (extraction.data.as_dict().values() if extraction else [])
                        if v is not None
                    ),
                },
            )
        )

    db.add(
        AuditEvent(
            deviation_id=deviation.id,
            event_type="created",
            actor=DEFAULT_ACTOR,
            details={"deviation_number": deviation.deviation_number},
        )
    )
    db.commit()
    db.refresh(deviation)
    return deviation


def list_deviations(
    db: Session,
    search: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Deviation], int]:
    query = db.query(Deviation)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Deviation.title.ilike(term),
                Deviation.batch_number.ilike(term),
                Deviation.deviation_number.ilike(term),
                Deviation.product_name.ilike(term),
            )
        )
    if severity:
        query = query.filter(Deviation.final_severity == severity)
    if status:
        query = query.filter(Deviation.status == status)

    total = query.count()
    items = (
        query.order_by(Deviation.created_at.desc())
        .offset(max(page - 1, 0) * page_size)
        .limit(min(page_size, 100))
        .all()
    )
    return items, total


def get_deviation(db: Session, deviation_id: UUID) -> Deviation:
    deviation = db.get(Deviation, deviation_id)
    if deviation is None:
        raise NotFound(f"Deviation {deviation_id} not found.")
    return deviation


def update_deviation(
    db: Session, deviation_id: UUID, payload: DeviationUpdate
) -> Deviation:
    deviation = get_deviation(db, deviation_id)
    # Only fields the client actually sent. AI-derived columns
    # (ai_recommended_severity, ai_impact_level, ai_reason, ai_confidence_avg)
    # are omitted by the frontend on edit and must survive the update.
    incoming = payload.model_dump(exclude_unset=True)

    changed: dict[str, dict] = {}
    for field, new_value in incoming.items():
        old_value = getattr(deviation, field, None)
        if old_value != new_value:
            changed[field] = {"from": _jsonable(old_value), "to": _jsonable(new_value)}
            setattr(deviation, field, new_value)

    if changed:
        severity_change = changed.pop("final_severity", None)
        if severity_change:
            db.add(
                AuditEvent(
                    deviation_id=deviation.id,
                    event_type="severity_overridden",
                    actor=DEFAULT_ACTOR,
                    details=severity_change,
                )
            )
        if changed:
            db.add(
                AuditEvent(
                    deviation_id=deviation.id,
                    event_type="field_edited",
                    actor=DEFAULT_ACTOR,
                    details=changed,
                )
            )
        db.commit()
        db.refresh(deviation)
    return deviation


def _jsonable(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value
