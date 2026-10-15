"""Severity recommendation node (LLM-backed). Failures are recorded, not fatal."""
from app.ai import prompts
from app.ai.nodes._call import call_for_model
from app.ai.provider import get_provider
from app.ai.state import DeviationState
from app.errors import AiTimeout, AiUnavailable
from app.schemas.deviation import SeverityAssessment, ValidationReport


def assess_severity(state: DeviationState) -> dict:
    stages = state.get("stages", []) + ["assess_severity"]
    updates: dict = {"stages": stages}
    if state.get("failed") or not state.get("extracted"):
        return updates

    provider = get_provider(state.get("provider"))
    updates["provider"] = provider.name
    updates["model"] = provider.model
    errors = list(state.get("errors", []))

    validation = state.get("validation") or ValidationReport()
    context = {
        "fields": state["extracted"].data.model_dump(),
        "validation": validation.model_dump(),
        "impact": (state.get("impact").model_dump() if state.get("impact") else None),
        "average_confidence": state["extracted"].average_confidence(),
    }
    raw_text = (state.get("raw_text") or "")[:4000]
    user = prompts.severity_user(context, raw_text)

    try:
        severity = call_for_model(
            provider, prompts.SYSTEM_SEVERITY, user, SeverityAssessment
        )
    except (AiUnavailable, AiTimeout) as exc:
        return {
            **updates,
            "errors": errors + [f"Severity assessment failed: {exc}"],
            "error_code": getattr(exc, "code", "ai_unavailable"),
        }

    # Deterministic guarantee: validation gaps are always surfaced to the reviewer.
    severity.missing_information = list(
        dict.fromkeys(severity.missing_information + validation.missing_information)
    )
    return {**updates, "severity": severity}
