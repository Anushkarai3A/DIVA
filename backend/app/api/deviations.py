"""Deviation CRUD endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.deviation import (
    DeviationCreate,
    DeviationDetail,
    DeviationListResponse,
    DeviationOut,
    DeviationUpdate,
)
from app.services import deviation_service

router = APIRouter(prefix="/api/deviations", tags=["deviations"])


@router.post("", response_model=DeviationOut, status_code=status.HTTP_201_CREATED)
def create_deviation(payload: DeviationCreate, db: Session = Depends(get_db)):
    deviation = deviation_service.create_deviation(db, payload)
    return DeviationOut.model_validate(deviation)


@router.get("", response_model=DeviationListResponse)
def list_deviations(
    search: str | None = Query(None),
    severity: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = deviation_service.list_deviations(
        db, search=search, severity=severity, status=status_filter, page=page, page_size=page_size
    )
    return DeviationListResponse(
        items=[DeviationOut.model_validate(i) for i in items], total=total
    )


@router.get("/{deviation_id}", response_model=DeviationDetail)
def get_deviation(deviation_id: UUID, db: Session = Depends(get_db)):
    deviation = deviation_service.get_deviation(db, deviation_id)
    return DeviationDetail.model_validate(deviation)


@router.put("/{deviation_id}", response_model=DeviationOut)
def update_deviation(
    deviation_id: UUID, payload: DeviationUpdate, db: Session = Depends(get_db)
):
    deviation = deviation_service.update_deviation(db, deviation_id, payload)
    return DeviationOut.model_validate(deviation)
