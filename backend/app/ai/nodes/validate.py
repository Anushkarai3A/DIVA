"""Deterministic validation: required fields, dates, grounding, confidence rules.

Grounding: values in GROUNDING_CHECKED_FIELDS must appear in the normalized
source text, else they are flagged `ungrounded` and confidence is cut to <=0.4
so the UI shows an amber "verify" badge instead of trusting a fabrication.
"""
import re

from app.ai.state import DeviationState
from app.schemas.deviation import (
    EXTRACTION_FIELDS,
    GROUNDING_CHECKED_FIELDS,
    REQUIRED_EXTRACTION_FIELDS,
    ExtractionResult,
    ValidationReport,
    coerce_date,
)

_DATE_FIELDS = ("event_date", "reported_date")
_LOW_CONFIDENCE = 0.6
_GROUNDING_FLOOR = 0.4
_DASHES = str.maketrans({"\u2013": "-", "\u2014": "-", "\u2212": "-"})


def _norm(value: str) -> str:
    value = value.translate(_DASHES).strip().strip(".,;:").lower()
    return re.sub(r"\s+", " ", value)


def compute_validation(
    extracted: ExtractionResult, raw_text: str
) -> ValidationReport:
    missing: list[str] = []
    low: list[str] = []
    ungrounded: list[str] = []
    errors: list[str] = []

    haystack = _norm(raw_text or "")

    for field in EXTRACTION_FIELDS:
        value = getattr(extracted.data, field)
        if value is None:
            extracted.confidence[field] = 0.0
            continue

        confidence = extracted.confidence_for(field)

        if field in _DATE_FIELDS and coerce_date(value) is None:
            errors.append(
                f"{field}: '{value}' is not a recognized date format (expected YYYY-MM-DD)."
            )

        if (
            field in GROUNDING_CHECKED_FIELDS
            and haystack
            and _norm(value) not in haystack
        ):
            ungrounded.append(field)
            confidence = min(confidence, _GROUNDING_FLOOR)

        confidence = max(0.0, min(1.0, confidence))
        extracted.confidence[field] = round(confidence, 3)
        if confidence < _LOW_CONFIDENCE:
            low.append(field)

    missing = [
        field
        for field in REQUIRED_EXTRACTION_FIELDS
        if getattr(extracted.data, field) is None
    ]
    return ValidationReport(
        missing_information=missing,
        low_confidence=low,
        ungrounded=ungrounded,
        errors=errors,
        critical_missing=len(missing) == len(REQUIRED_EXTRACTION_FIELDS),
    )


def validate_extraction(state: DeviationState) -> dict:
    stages = state.get("stages", []) + ["validate"]
    if state.get("failed") or not state.get("extracted"):
        return {"stages": stages}
    validation = compute_validation(
        state["extracted"], state.get("raw_text") or ""
    )
    return {"validation": validation, "stages": stages}
