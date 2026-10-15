"""Typed LangGraph state for the deviation intake pipeline."""
from typing import TypedDict

from app.schemas.deviation import (
    ExtractionResult,
    ImpactAssessment,
    SeverityAssessment,
    ValidationReport,
)


class DeviationState(TypedDict, total=False):
    # Input
    raw_text: str
    source_type: str  # pdf | docx | txt | text | email
    # Pipeline outputs
    extracted: ExtractionResult
    validation: ValidationReport
    impact: ImpactAssessment
    severity: SeverityAssessment
    explanation: str
    # Control
    provider: str  # groq | demo
    model: str
    errors: list[str]
    failed: bool
    error_code: str | None  # ai_rate_limited | ai_timeout | ai_invalid_response | ...
    stages: list[str]  # completed node names (for observability)


def initial_state(raw_text: str, source_type: str = "text", provider: str = "demo") -> DeviationState:
    return DeviationState(
        raw_text=raw_text,
        source_type=source_type,
        provider=provider,
        errors=[],
        failed=False,
        stages=[],
    )
