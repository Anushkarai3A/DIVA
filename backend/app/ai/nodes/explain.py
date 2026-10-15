"""Human-readable explanation node — deterministic templating, no extra LLM call."""
from app.ai.state import DeviationState
from app.schemas.deviation import EXTRACTION_FIELDS, ValidationReport


def generate_explanation(state: DeviationState) -> dict:
    stages = state.get("stages", []) + ["generate_explanation"]
    if state.get("failed"):
        return {"stages": stages, "explanation": None}

    extraction = state.get("extracted")
    validation = state.get("validation") or ValidationReport()
    impact = state.get("impact")
    severity = state.get("severity")

    if validation.critical_missing or extraction is None:
        return {
            "stages": stages,
            "explanation": (
                "Insufficient information: the source did not contain enough detail "
                "to populate the required fields"
                + (f" ({', '.join(validation.missing_information)})" if validation.missing_information else "")
                + ". No values were invented - review the source document and "
                "complete the form manually. (AI-generated advisory - not a QA decision.)"
            ),
        }

    populated = sum(
        1 for field in EXTRACTION_FIELDS if getattr(extraction.data, field) is not None
    )
    parts = [
        f"Extracted {populated} of {len(EXTRACTION_FIELDS)} fields with an average "
        f"confidence of {round(extraction.average_confidence() * 100)}%."
    ]
    if impact:
        parts.append(f"Impact: {impact.impact_level}. {impact.reason}")
    else:
        parts.append("Impact assessment unavailable.")
    if severity:
        parts.append(
            f"Severity recommendation: {severity.recommended_severity} "
            f"({round(severity.confidence * 100)}% confidence). {severity.reason}"
        )
    else:
        parts.append("Severity recommendation unavailable.")
    if validation.missing_information:
        parts.append("Missing from source: " + ", ".join(validation.missing_information) + ".")
    if validation.ungrounded:
        parts.append(
            "Values not found in the source text (please verify): "
            + ", ".join(validation.ungrounded)
            + "."
        )
    if validation.errors:
        parts.append("Notes: " + " ".join(validation.errors))
    parts.append(
        "This is an AI-generated advisory assessment; the final classification "
        "is the reviewer's decision."
    )
    return {"explanation": " ".join(parts), "stages": stages}
