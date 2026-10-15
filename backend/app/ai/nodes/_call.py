"""Shared helper: one provider call + one schema-validation repair retry."""
import json
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.ai import prompts
from app.ai.provider import LLMProvider
from app.errors import AiInvalidResponse, AiTimeout, AiUnavailable

T = TypeVar("T", bound=BaseModel)


def call_for_model(
    provider: LLMProvider,
    system: str,
    user: str,
    model_cls: type[T],
) -> T:
    """Complete a JSON task and validate it into `model_cls`; one repair retry.

    Raises AiUnavailable / AiTimeout (provider errors) or AiUnavailable
    (schema mismatch after repair).
    """
    data: Any = provider.complete_json(system, user)
    try:
        return model_cls.model_validate(data)
    except ValidationError as first_exc:
        detail = json.dumps(
            first_exc.errors(include_url=False, include_context=False)[:5],
            default=str,
        )
        repair = (
            "Your previous response failed validation with these errors: "
            f"{detail}. Return the full corrected JSON object only."
        )
        data = provider.complete_json(system, user, repair_note=repair)
        try:
            return model_cls.model_validate(data)
        except ValidationError as exc:
            raise AiInvalidResponse(
                f"The AI response did not match the required schema "
                f"({exc.error_count()} errors) even after a repair retry."
            ) from exc
    except (AiTimeout, AiUnavailable):
        raise
    except Exception as exc:  # defensive: model_cls.model_validate quirks
        raise AiInvalidResponse(f"Could not interpret the AI response: {exc}") from exc


__all__ = ["call_for_model", "prompts"]
