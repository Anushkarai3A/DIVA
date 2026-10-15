"""LLM providers behind a single interface.

- GroqProvider: real LLM (langchain-groq), JSON mode, per-call timeout, and a
  bounded rate-limit retry (3 attempts, 2s/5s backoff, Retry-After respected,
  max 30s). SDK retries are disabled (max_retries=0) so there is exactly ONE
  retry system. 429 -> AiRateLimited (429), timeout -> AiTimeout (504),
  bad content -> AiInvalidResponse (502).
- DemoProvider: deterministic rule engine, selected only via DEMO_MODE=true.

get_provider() selects by settings.DEMO_MODE / key presence. There is NO
automatic runtime switch from Groq to Demo: real failures surface as typed
errors so the UI can report them honestly.
"""
import json
import logging
import re
import time
from typing import Any, Protocol

from app import tracing
from app.config import settings
from app.errors import AiInvalidResponse, AiRateLimited, AiTimeout, AiUnavailable
from app.schemas.deviation import EXTRACTION_FIELDS

logger = logging.getLogger("diva.ai")

_MAX_ATTEMPTS = 3
_BACKOFF_S = (2.0, 5.0)  # wait after attempt 1 / attempt 2 (bounded at 3 attempts)
_MAX_BACKOFF_S = 30.0


class LLMProvider(Protocol):
    name: str
    model: str

    def complete_json(self, system: str, user: str, repair_note: str | None = None) -> dict:
        """Return a parsed JSON dict from the model. Raises AiUnavailable/AiTimeout."""
        ...


# ---------------------------------------------------------------------------
# Groq (real)
# ---------------------------------------------------------------------------


class GroqProvider:
    name = "groq"

    def __init__(self) -> None:
        from langchain_groq import ChatGroq

        self.model = settings.GROQ_MODEL
        self._llm = ChatGroq(
            model=self.model,
            api_key=settings.GROQ_API_KEY or None,
            temperature=0,
            max_tokens=4096,
            request_timeout=settings.AI_TIMEOUT_S,
            max_retries=0,  # OUR bounded retry below is the only retry loop
            model_kwargs={"response_format": {"type": "json_object"}},
        )

    def complete_json(self, system: str, user: str, repair_note: str | None = None) -> dict:
        from langchain_core.messages import HumanMessage, SystemMessage

        user_content = user if not repair_note else f"{user}\n\n{repair_note}"
        attempt = 0
        rate_limited_attempts = 0
        while True:
            attempt += 1
            tracing.stage("Groq attempt %d/%d", attempt, _MAX_ATTEMPTS)
            try:
                response = self._llm.invoke(
                    [SystemMessage(content=system), HumanMessage(content=user_content)]
                )
                tracing.stage("Groq 200 OK (attempt %d/%d)", attempt, _MAX_ATTEMPTS)
                break
            except Exception as exc:  # auth, connection, rate limit, timeout
                if _is_rate_limit(exc):
                    rate_limited_attempts += 1
                    if attempt >= _MAX_ATTEMPTS:
                        tracing.stage(
                            "429 on final attempt %d/%d - giving up", attempt, _MAX_ATTEMPTS
                        )
                        raise AiRateLimited(
                            f"The AI service is rate limited. This request was retried "
                            f"{_MAX_ATTEMPTS} times without success - please retry in a moment."
                        ) from exc
                    backoff = _BACKOFF_S[attempt - 1]
                    wait = min(max(backoff, _retry_after_seconds(exc)), _MAX_BACKOFF_S)
                    tracing.stage(
                        "429 rate limited (attempt %d/%d) - retrying in %.1fs",
                        attempt,
                        _MAX_ATTEMPTS,
                        wait,
                    )
                    time.sleep(wait)
                    continue
                message = str(exc).lower()
                tracing.stage("Groq error on attempt %d/%d: %s", attempt, _MAX_ATTEMPTS, type(exc).__name__)
                if "time" in message or "timeout" in message:
                    raise AiTimeout(f"AI request timed out after {settings.AI_TIMEOUT_S}s.") from exc
                detail = re.sub(r"gsk_\S+", "gsk_***", str(exc))[:200]
                raise AiUnavailable(f"AI provider error: {type(exc).__name__}: {detail}") from exc

        if rate_limited_attempts:
            tracing.add_retry_note(
                f"AI service was rate limited; succeeded on attempt "
                f"{attempt} of {_MAX_ATTEMPTS}."
            )

        content = response.content
        if isinstance(content, list):  # some models return content blocks
            content = "".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in content
            )
        parsed = _parse_json(str(content))
        tracing.stage("Structured output validated (JSON)")
        return parsed


def _is_rate_limit(exc: Exception) -> bool:
    if getattr(exc, "status_code", None) == 429 or getattr(exc, "status", None) == 429:
        return True
    text = str(exc).lower()
    return "429" in text or "rate limit" in text or "rate-limit" in text or "too many requests" in text


def _retry_after_seconds(exc: Exception) -> float:
    """Read Retry-After from the provider response, if present (0.0 otherwise)."""
    headers = getattr(getattr(exc, "response", None), "headers", None)
    if headers is None:
        headers = getattr(exc, "headers", None)
    if not headers:
        return 0.0
    try:
        raw = headers.get("retry-after")
        return max(0.0, float(raw)) if raw else 0.0
    except (TypeError, ValueError, AttributeError):
        return 0.0


def _parse_json(text: str) -> dict:
    """Parse JSON, tolerating code fences and leading/trailing prose."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    raise AiInvalidResponse("AI returned a response that was not valid JSON.")


# ---------------------------------------------------------------------------
# Demo (deterministic, no key)
# ---------------------------------------------------------------------------

_FACT_SENTENCE_MARKERS = re.compile(
    r"exceed|above|below|outside|deviat|excursion|out.of.range|out.of.spec|"
    r"impact|affect|may |potential", re.I
)
_ACTION_SENTENCE_MARKERS = re.compile(
    r"stopped|notified|initiat|quarantin|hold|placed|adjusted|corrected|escalat", re.I
)


class DemoProvider:
    """Deterministic extraction/assessment engine for DEMO_MODE.

    Grounded strictly in what the text actually says: unknown inputs produce
    nulls with 0.0 confidence — never fabricated values.
    """
    name = "demo"
    model = "deterministic-demo"

    def complete_json(self, system: str, user: str, repair_note: str | None = None) -> dict:
        task = _task_of(system)
        document = _tag(user, "document") or ""
        context_raw = _tag(user, "context") or ""
        context: dict[str, Any] = {}
        if context_raw:
            try:
                context = json.loads(context_raw)
            except json.JSONDecodeError:
                context = {}

        if task == "EXTRACT":
            return self._extract(document)
        if task == "IMPACT":
            return self._impact(context)
        if task == "SEVERITY":
            return self._severity(context)
        if task == "REFINE":
            return self._refine(context, document)
        raise AiUnavailable(f"DemoProvider received unknown task: {task[:40]!r}")

    # -- extraction ---------------------------------------------------------
    def _extract(self, text: str) -> dict[str, Any]:
        fields: dict[str, str | None] = {k: None for k in EXTRACTION_FIELDS}
        confidence: dict[str, float] = {k: 0.0 for k in EXTRACTION_FIELDS}
        evidence: dict[str, str | None] = {k: None for k in EXTRACTION_FIELDS}

        def set_field(key: str, value: str | None, conf: float, ev: str | None) -> None:
            if value:
                fields[key] = value.strip().strip(",.;:")
                confidence[key] = round(conf, 2)
                evidence[key] = (ev or "").strip()[:400] or None

        lines = text.split("\n")

        # 1) Labeled "Key: value" lines (highest confidence).
        label_map = {
            "product": "product_name",
            "batch number": "batch_number",
            "site": "site",
            "department": "department",
            "manufacturing stage": "manufacturing_stage",
            "product code": "product_code",
            "equipment": "equipment",
            "equipment id": "equipment_id",
        }
        for line in lines:
            if ":" not in line:
                continue
            label, _, value = line.partition(":")
            key = label_map.get(label.strip().lower())
            if key and value.strip():
                set_field(key, value, 0.97, line)

        # 2) Pattern facts.
        batch_match = re.search(r"\bAPI-\d{6}\b", text) or re.search(
            r"\b(?:batch|lot)\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{3,})\b",
            text, re.I,
        )
        if batch_match and not fields["batch_number"]:
            set_field("batch_number", batch_match.group(0), 0.95, _sentence(text, batch_match.start()))
        elif batch_match and fields["batch_number"]:
            evidence.setdefault("batch_number", _sentence(text, batch_match.start()))

        range_match = re.search(r"(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)", text)
        if range_match:
            set_field(
                "approved_range",
                f"{range_match.group(1)}-{range_match.group(2)}",
                0.92,
                _sentence(text, range_match.start()),
            )
        # actual value: prefer "reached N", "was N", "N °C" AFTER the range match
        actual_match = (
            re.search(r"reached\s+(\d+(?:\.\d+)?)", text, re.I)
            or re.search(r"\baround\s+(\d+(?:\.\d+)?)\s*(°C|°F|C\b|F\b|mbar|bar|psi|%)", text, re.I)
            or re.search(r"(?:actual|observed)[^.]{0,40}?(\d+(?:\.\d+)?)", text, re.I)
        )
        if actual_match:
            set_field(
                "actual_value",
                actual_match.group(1),
                0.92,
                _sentence(text, actual_match.start()),
            )

        unit_match = re.search(r"(°C|°F|\bmbar\b|\bbar\b|\bpsi\b|%)", text)
        if unit_match and fields["actual_value"]:
            set_field("unit", unit_match.group(1), 0.9, unit_match.group(0))

        duration_match = re.search(
            r"(?:for|approximately|about|around|~)\s*(?:approximately\s*|about\s*|around\s*|~\s*)?"
            r"(\d+(?:\.\d+)?\s*(?:minute|hour|min|hr)s?)",
            text, re.I,
        )
        if duration_match:
            set_field("duration", duration_match.group(1), 0.9, _sentence(text, duration_match.start()))

        equipment_id = re.search(r"\b([A-Z]{1,3}-\d{2,4})\b", text)
        if equipment_id and equipment_id.group(0) != (fields["batch_number"] or "").upper():
            set_field("equipment_id", equipment_id.group(0), 0.94, _sentence(text, equipment_id.start()))
            if re.search(r"reactor", text, re.I):
                set_field("equipment", "Reactor", 0.9, _sentence(text, equipment_id.start()))

        stage_match = re.search(
            r"\b(?:stage|step)\s*[:\-]\s*([A-Za-z]+)", text, re.I
        )
        if stage_match and not fields["manufacturing_stage"]:
            set_field("manufacturing_stage", stage_match.group(1), 0.8, stage_match.group(0))

        # process parameter
        param_match = re.search(
            r"\b(reactor temperature|temperature|pressure|flow rate|humidity|pH|agitation speed|level)\b",
            text, re.I,
        )
        if param_match:
            raw_param = param_match.group(1)
            pretty = raw_param.capitalize()
            if re.search(r"reactor", text, re.I) and raw_param.lower() == "temperature":
                pretty = "Reactor temperature"
            set_field("process_parameter", pretty, 0.9, _sentence(text, param_match.start()))

        # 3) Sentence-derived fields.
        set_field("deviation_description", _sentences_matching(text, _FACT_SENTENCE_MARKERS, limit=2), 0.85, None)
        set_field("immediate_action", _sentences_matching(text, _ACTION_SENTENCE_MARKERS, limit=1), 0.82, None)
        potential = _sentences_matching(
            text, re.compile(r"potential|may (?:have an )?impact|could affect", re.I), limit=1
        )
        set_field("potential_impact", potential, 0.75, None)
        root_cause = _sentences_matching(
            text, re.compile(r"root cause|caused by|due to (?:a|the|an)", re.I), limit=1
        )
        set_field("root_cause_indication", root_cause, 0.7, None)

        # event date if an explicit date exists
        date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
        if date_match:
            set_field("event_date", date_match.group(1), 0.9, date_match.group(0))

        # title: derived summary of extracted facts (not an invented fact)
        if fields["process_parameter"] and fields["manufacturing_stage"]:
            title = f"{fields['process_parameter']} deviation during {fields['manufacturing_stage'].lower()} stage"
            set_field("deviation_title", title, 0.8, None)
        elif fields["process_parameter"] and fields["batch_number"]:
            set_field(
                "deviation_title",
                f"{fields['process_parameter']} deviation - batch {fields['batch_number']}",
                0.8, None,
            )

        # null fields must carry 0.0 confidence
        for key in EXTRACTION_FIELDS:
            if fields[key] is None:
                confidence[key] = 0.0
                evidence[key] = evidence.get(key)

        return {"data": fields, "confidence": confidence, "evidence": evidence}

    # -- impact -------------------------------------------------------------
    def _impact(self, context: dict[str, Any]) -> dict[str, Any]:
        fields = context.get("fields") or {}
        param = fields.get("process_parameter")
        actual = fields.get("actual_value")
        approved = fields.get("approved_range")
        batch = fields.get("batch_number")
        duration = fields.get("duration")

        factors = []
        if param and actual and approved:
            factors.append(f"{param} of {actual} outside approved range {approved}")
        if duration:
            factors.append(f"Condition persisted for {duration}")
        if batch:
            factors.append(f"Batch {batch} potentially affected")

        if len(factors) >= 2:
            level = "High"
            areas = ["Product quality", "Process impact", "Batch integrity", "Process control"]
            reason = (
                f"{param} reached {actual} against an approved range of {approved}"
                + (f" for {duration}" if duration else "")
                + f". Batch {batch} may be affected pending QA review of the excursion."
            )
        elif factors:
            level = "Medium"
            areas = ["Process impact", "Process control"]
            reason = "A process parameter deviation is documented; extent of product impact is not yet established from the supplied information."
        else:
            level = "Medium"
            areas = ["Process impact"]
            reason = "Limited factual detail was supplied; impact cannot be narrowed further without additional information."

        return {
            "impact_level": level,
            "impact_areas": areas,
            "reason": reason,
            "supporting_factors": factors or ["Insufficient detail in supplied information"],
            "disclaimer": "AI-generated initial assessment for review. Not a QA or regulatory decision.",
        }

    # -- severity -----------------------------------------------------------
    def _severity(self, context: dict[str, Any]) -> dict[str, Any]:
        fields = context.get("fields") or {}
        validation = context.get("validation") or {}
        missing = validation.get("missing_information") or []
        param = fields.get("process_parameter")
        actual = fields.get("actual_value")
        approved = fields.get("approved_range")
        batch = fields.get("batch_number")
        duration = fields.get("duration")

        if param and actual and approved and batch:
            severity = "Major"
            confidence = 0.72 if len(missing) <= 2 else 0.6
            factors = [
                f"Out-of-range process parameter ({param} {actual} vs approved {approved})",
                f"Batch {batch} under review",
                "Requires formal deviation investigation",
            ]
            if duration:
                factors.insert(1, f"Excursion duration: {duration}")
            reason = (
                f"The {param.lower()} exceeded the approved range ({approved}) reaching {actual}"
                + (f" for {duration}" if duration else "")
                + f", which is a documented out-of-specification condition for batch {batch}. "
                "Classification as Major reflects the potential product-quality impact and the "
                "need for investigation; final classification rests with QA."
            )
        elif param or batch:
            severity = "Minor"
            confidence = 0.45
            factors = ["Limited deviation facts supplied", "No confirmed product impact stated"]
            reason = "Only partial information is available. On the supplied facts the event is documented as a Minor deviation, but confidence is reduced pending missing details."
        else:
            severity = "Minor"
            confidence = 0.3
            factors = ["Key deviation facts missing from supplied information"]
            reason = "Insufficient information to support a Major or Critical classification; a lower classification is recommended pending review of the source document."

        return {
            "recommended_severity": severity,
            "confidence": confidence,
            "reason": reason,
            "factors": factors,
            "missing_information": missing,
        }

    # -- refine -------------------------------------------------------------
    def _refine(self, context: dict[str, Any], document: str) -> dict[str, Any]:
        instruction = (context.get("instruction") or "").lower()
        current: dict[str, Any] = context.get("current_fields") or {}
        validation = context.get("validation") or {}
        proposals: list[dict[str, Any]] = []
        message: str | None = None

        if any(w in instruction for w in ("rephrase", "professional", "rewrite", "polish")):
            description = current.get("deviation_description")
            if description:
                improved = _professionalize(description)
                if improved != description:
                    proposals.append({
                        "field": "deviation_description",
                        "current_value": description,
                        "proposed_value": improved,
                        "reason": "Rewritten for a clear, professional QA narrative while preserving the original facts.",
                    })
            if not proposals:
                message = "The description is already written in a professional style."

        elif any(w in instruction for w in ("missing", "not available", "gaps", "incomplete")):
            missing = validation.get("missing_information") or []
            low = validation.get("low_confidence") or []
            bits = []
            if missing:
                bits.append("Missing required information: " + ", ".join(missing))
            if low:
                bits.append("Low-confidence fields to review: " + ", ".join(low))
            if document:
                absent = [
                    f for f in ("product_code", "event_date", "reported_date", "root_cause_indication")
                    if not current.get(f) and not _present_in(f, document)
                ]
                if absent:
                    bits.append(
                        "Not present in the source document (AI will not invent them): "
                        + ", ".join(absent)
                    )
            message = " ".join(bits) if bits else "No missing information detected."

        elif "severity" in instruction or "major" in instruction or "why" in instruction:
            message = (
                "See the severity panel: the recommendation, confidence, factors and "
                "missing_information are listed there. You can accept or override it — "
                "the saved severity is always your decision."
            )

        elif "batch" in instruction:
            doc_batch = re.search(r"\bAPI-\d{6}\b", document)
            if doc_batch:
                proposed = doc_batch.group(0)
                if proposed != (current.get("batch_number") or ""):
                    proposals.append({
                        "field": "batch_number",
                        "current_value": current.get("batch_number"),
                        "proposed_value": proposed,
                        "reason": f"Value grounded in source document: {doc_batch.group(0)}.",
                    })
                else:
                    message = f"The batch number already matches the document ({proposed})."
            else:
                message = "No batch number was found in the supplied document."

        else:
            message = "Demo AI supports: rephrase description, list missing information, explain severity, re-extract batch number."

        return {"proposals": proposals, "message": message}


# ---------------------------------------------------------------------------
# Demo helpers
# ---------------------------------------------------------------------------


def _task_of(system: str) -> str:
    match = re.match(r"TASK=(\w+)", system.strip())
    if not match:
        raise AiUnavailable("Prompt is missing the TASK marker.")
    return match.group(1)


def _tag(content: str, name: str) -> str | None:
    match = re.search(rf"<{name}>(.*?)</{name}>", content, re.DOTALL)
    return match.group(1).strip() if match else None


def _sentence(text: str, position: int) -> str:
    start = text.rfind(".", 0, position)
    start = 0 if start == -1 else start + 1
    end = text.find(".", position)
    end = len(text) if end == -1 else end + 1
    return text[start:end].strip()


def _sentences_matching(text: str, pattern: re.Pattern, limit: int) -> str | None:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    hits = [s.strip() for s in sentences if pattern.search(s)]
    if not hits:
        return None
    return " ".join(hits[:limit])


def _professionalize(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = text[0].upper() + text[1:] if text else text
    if not text.endswith("."):
        text += "."
    replacements = {
        "went above": "exceeded",
        "went out of": "fell outside",
        " a lot of ": " significant ",
        "kind of ": "",
        " sort of ": "",
        "78-82": "78–82",
        "86 C": "86°C",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def _present_in(field: str, document: str) -> bool:
    patterns = {
        "product_code": r"\bproduct code\b",
        "event_date": r"\b\d{4}-\d{2}-\d{2}\b",
        "reported_date": r"\breported\s*(?:on|date)\b",
        "root_cause_indication": r"\broot cause\b|\bcaused by\b",
    }
    pattern = patterns.get(field)
    return bool(pattern and re.search(pattern, document, re.I))


# ---------------------------------------------------------------------------
# Selection
# ---------------------------------------------------------------------------


def get_provider(name: str | None = None) -> LLMProvider:
    """Resolve a provider. `name` forces "demo" or "groq" (graph nodes re-resolve from state)."""
    if name == "demo":
        return DemoProvider()
    if name == "groq":
        if settings.GROQ_API_KEY:
            return GroqProvider()
        logger.warning("Provider 'groq' requested but GROQ_API_KEY missing — using DemoProvider")
        return DemoProvider()
    if settings.DEMO_MODE:
        return DemoProvider()
    if not settings.GROQ_API_KEY:
        logger.warning("DEMO_MODE=false but GROQ_API_KEY missing — using DemoProvider")
        return DemoProvider()
    return GroqProvider()
