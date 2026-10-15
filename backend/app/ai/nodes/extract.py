"""Extraction node: one provider call -> strict ExtractionResult, one repair retry."""
import json

from pydantic import ValidationError

from app.ai import prompts
from app.ai.provider import get_provider
from app.ai.state import DeviationState
from app.errors import AiTimeout, AiUnavailable
from app.schemas.deviation import EXTRACTION_FIELDS, ExtractionResult


def extract_deviation(state: DeviationState) -> dict:
    stages = state.get("stages", []) + ["extract"]
    if state.get("failed"):
        return {"stages": stages}

    provider = get_provider(state.get("provider"))
    errors = list(state.get("errors", []))
    updates: dict = {
        "stages": stages,
        "provider": provider.name,
        "model": provider.model,
    }

    raw_text = state.get("raw_text") or ""
    user = prompts.extract_user(raw_text)
    try:
        data = provider.complete_json(prompts.SYSTEM_EXTRACT, user)
        try:
            result = ExtractionResult.model_validate(data)
        except ValidationError as first_exc:
            detail = json.dumps(
                first_exc.errors(include_url=False, include_context=False)[:5],
                default=str,
            )
            repair = (
                "Your previous response failed validation with these errors: "
                f"{detail}. Return the full corrected JSON object only."
            )
            data = provider.complete_json(
                prompts.SYSTEM_EXTRACT, user, repair_note=repair
            )
            result = ExtractionResult.model_validate(data)
    except (AiUnavailable, AiTimeout) as exc:
        return {
            **updates,
            "failed": True,
            "errors": errors + [str(exc)],
            "error_code": getattr(exc, "code", "ai_unavailable"),
        }
    except ValidationError as exc:
        return {
            **updates,
            "failed": True,
            "errors": errors
            + [
                "The AI response did not match the required schema "
                f"({exc.error_count()} errors) even after a repair retry."
            ],
            "error_code": "ai_invalid_response",
        }

    # Enforce: null field => confidence 0.0, every field has a confidence entry.
    for field in EXTRACTION_FIELDS:
        if getattr(result.data, field) is None:
            result.confidence[field] = 0.0
        else:
            result.confidence[field] = result.confidence_for(field)
    updates["extracted"] = result
    return updates
