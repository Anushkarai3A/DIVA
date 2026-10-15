"""Impact assessment node (LLM-backed). Failures are recorded, not fatal —
the pipeline still returns extraction + validation."""
from app.ai import prompts
from app.ai.nodes._call import call_for_model
from app.ai.provider import get_provider
from app.ai.state import DeviationState
from app.errors import AiTimeout, AiUnavailable
from app.schemas.deviation import IMPACT_AREAS, ImpactAssessment, ValidationReport


def assess_impact(state: DeviationState) -> dict:
    stages = state.get("stages", []) + ["assess_impact"]
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
        "impact_areas": list(IMPACT_AREAS),
        "average_confidence": state["extracted"].average_confidence(),
    }
    raw_text = (state.get("raw_text") or "")[:4000]
    user = prompts.impact_user(context, raw_text)

    try:
        impact = call_for_model(provider, prompts.SYSTEM_IMPACT, user, ImpactAssessment)
    except (AiUnavailable, AiTimeout) as exc:
        return {
            **updates,
            "errors": errors + [f"Impact assessment failed: {exc}"],
            "error_code": getattr(exc, "code", "ai_unavailable"),
        }
    return {**updates, "impact": impact}
