"""AI endpoints (extraction, impact, severity, refinement)."""
from fastapi import APIRouter

from app.schemas.deviation import (
    AiExtractRequest,
    AiPipelineResponse,
    AssessImpactRequest,
    AssessImpactResponse,
    AssessSeverityRequest,
    AssessSeverityResponse,
    RefineRequest,
    RefineResponse,
)
from app.services import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/extract-deviation", response_model=AiPipelineResponse)
def extract_deviation(request: AiExtractRequest) -> AiPipelineResponse:
    """Full pipeline: extract -> validate -> assess impact/severity -> explain."""
    return ai_service.run_pipeline(
        request.text, request.source_type, request_id=request.request_id
    )


@router.post("/assess-impact", response_model=AssessImpactResponse)
def assess_impact(request: AssessImpactRequest) -> AssessImpactResponse:
    """Re-run impact only (after human edits)."""
    return ai_service.assess_impact(request.fields, request.raw_text)


@router.post("/assess-severity", response_model=AssessSeverityResponse)
def assess_severity(request: AssessSeverityRequest) -> AssessSeverityResponse:
    """Re-run severity only (after human edits)."""
    return ai_service.assess_severity(
        request.fields, request.validation, request.raw_text
    )


@router.post("/refine", response_model=RefineResponse)
def refine(request: RefineRequest) -> RefineResponse:
    """Propose field corrections — proposals are never auto-applied."""
    return ai_service.refine(
        request.instruction,
        request.current_fields,
        request.validation,
        request.raw_text,
    )
