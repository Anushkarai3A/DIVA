"""AI service layer: full pipeline, partial re-assessment, human-refine proposals.

Design:
- run_pipeline: ONE real pipeline (Groq when configured, Demo only when
  DEMO_MODE=true). There is NO automatic Groq -> Demo switch: real provider
  failures surface as typed errors (AiRateLimited 429 / AiTimeout 504 /
  AiInvalidResponse 502 / AiUnavailable 502) so the UI reports them honestly.
- assess_* / refine: call node/provider functions directly with synthetic state.
- Every request is logged with an extraction id (see app.tracing).
"""
import time

from pydantic import ValidationError as PydanticValidationError

from app import tracing
from app.ai.graph import build_graph
from app.ai.nodes import assess_impact as _impact_node
from app.ai.nodes import assess_severity as _severity_node
from app.ai.nodes import compute_validation
from app.ai.prompts import SYSTEM_REFINE, refine_user
from app.ai.provider import get_provider
from app.ai.state import initial_state
from app.errors import (
    AiInvalidResponse,
    AiRateLimited,
    AiTimeout,
    AiUnavailable,
    AppError,
    EmptyDocument,
)
from app.schemas.deviation import (
    EXTRACTION_FIELDS,
    AiPipelineResponse,
    AssessImpactResponse,
    AssessSeverityResponse,
    ExtractedFields,
    ExtractionResult,
    RefineProposal,
    RefineResponse,
    ValidationReport,
)

GRAPH = build_graph()

_TYPED_ERRORS: dict[str, type[AppError]] = {
    "ai_rate_limited": AiRateLimited,
    "ai_timeout": AiTimeout,
    "ai_invalid_response": AiInvalidResponse,
    "ai_unavailable": AiUnavailable,
}


def _typed_error(error_code: str | None, message: str) -> AppError:
    """Re-raise with the exact category recorded by the failing node."""
    return _TYPED_ERRORS.get(error_code or "", AiUnavailable)(message)


def run_pipeline(
    text: str, source_type: str | None = None, request_id: str | None = None
) -> AiPipelineResponse:
    tracing.start(request_id)
    provider = get_provider()
    started = time.perf_counter()
    tracing.stage(
        "Graph started (provider=%s, source_type=%s)", provider.name, source_type or "text"
    )

    state = dict(
        GRAPH.invoke(initial_state(text, source_type or "text", provider.name))
    )
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    errors = tracing.drain_retry_notes() + list(state.get("errors") or [])

    tracing.stage(
        "Graph finished in %d ms (failed=%s, stages=%s)",
        elapsed_ms,
        bool(state.get("failed")),
        ",".join(state.get("stages") or []),
    )

    if state.get("failed") or not state.get("extracted"):
        message = "; ".join(state.get("errors") or errors) or "AI extraction failed."
        error_code = state.get("error_code")
        tracing.stage("Pipeline failed (code=%s): %s", error_code or "ai_unavailable", message)
        if "no readable text" in message.lower():
            raise EmptyDocument(message)
        raise _typed_error(error_code, message)

    tracing.stage(
        "Structured output validated (provider=%s)",
        state.get("provider") or provider.name,
    )
    response = AiPipelineResponse(
        extraction=state["extracted"],
        validation=state.get("validation") or ValidationReport(),
        impact=state.get("impact"),
        severity=state.get("severity"),
        explanation=state.get("explanation"),
        provider=state.get("provider") or provider.name,
        model=state.get("model") or provider.model,
        elapsed_ms=elapsed_ms,
        errors=errors,
        request_id=tracing.current(),
    )
    tracing.stage("Response returned to frontend (%d ms)", elapsed_ms)
    return response


def _assess_state(
    fields: ExtractedFields,
    raw_text: str | None,
    validation: ValidationReport | None,
) -> tuple[dict, object]:
    provider = get_provider()
    raw = raw_text or ""
    extracted = ExtractionResult(data=fields)
    if validation is None:
        validation = compute_validation(extracted, raw)
    state = {
        **initial_state(raw, "text", provider.name),
        "extracted": extracted,
        "validation": validation,
    }
    return state, provider


def assess_impact(
    fields: ExtractedFields, raw_text: str | None = None
) -> AssessImpactResponse:
    tracing.start()
    state, _provider = _assess_state(fields, raw_text, validation=None)
    result = _impact_node(state)
    if not result.get("impact"):
        message = "; ".join(result.get("errors") or ["Impact assessment failed."])
        tracing.stage("Impact assessment failed (code=%s)", result.get("error_code") or "ai_unavailable")
        raise _typed_error(result.get("error_code"), message)
    tracing.stage("Impact assessment returned")
    return AssessImpactResponse(
        impact=result["impact"],
        provider=result.get("provider") or "demo",
        model=result.get("model") or "",
    )


def assess_severity(
    fields: ExtractedFields,
    validation: ValidationReport | None = None,
    raw_text: str | None = None,
) -> AssessSeverityResponse:
    tracing.start()
    state, _provider = _assess_state(fields, raw_text, validation)
    result = _severity_node(state)
    if not result.get("severity"):
        message = "; ".join(result.get("errors") or ["Severity assessment failed."])
        tracing.stage("Severity assessment failed (code=%s)", result.get("error_code") or "ai_unavailable")
        raise _typed_error(result.get("error_code"), message)
    tracing.stage("Severity assessment returned")
    return AssessSeverityResponse(
        severity=result["severity"],
        provider=result.get("provider") or "demo",
        model=result.get("model") or "",
    )


def refine(
    instruction: str,
    current_fields: ExtractedFields,
    validation: ValidationReport | None = None,
    raw_text: str | None = None,
) -> RefineResponse:
    """Ask the model for proposals — never applied automatically."""
    tracing.start()
    provider = get_provider()
    user = refine_user(
        instruction,
        current_fields.model_dump(),
        validation.model_dump() if validation else None,
        raw_text or "",
    )
    data = provider.complete_json(SYSTEM_REFINE, user)

    proposals: list[RefineProposal] = []
    raw_proposals = data.get("proposals")
    if isinstance(raw_proposals, list):
        for item in raw_proposals:
            if not isinstance(item, dict):
                continue
            try:
                proposal = RefineProposal.model_validate(item)
            except PydanticValidationError:
                continue
            if proposal.field not in EXTRACTION_FIELDS:
                continue
            if (proposal.proposed_value or "").strip() == (
                proposal.current_value or ""
            ).strip():
                continue
            proposals.append(proposal)

    message = data.get("message")
    response = RefineResponse(
        proposals=proposals,
        message=message if isinstance(message, str) else None,
        provider=provider.name,
        model=provider.model,
    )
    tracing.stage("Refinement returned (%d proposals)", len(proposals))
    return response
