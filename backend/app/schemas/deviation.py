"""Pydantic schemas: API contracts + strict AI output contracts.

One source of truth: these schemas validate BOTH the LLM's structured output
and the API request/response bodies.
"""
from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Enums / literals
# ---------------------------------------------------------------------------

Severity = Literal["Minor", "Major", "Critical"]
ImpactLevel = Literal["Low", "Medium", "High", "Critical"]

IMPACT_AREAS = (
    "Product quality",
    "Patient safety",
    "Process impact",
    "Regulatory impact",
    "Batch integrity",
    "Process control",
)
ImpactArea = Literal[
    "Product quality",
    "Patient safety",
    "Process impact",
    "Regulatory impact",
    "Batch integrity",
    "Process control",
]

DeviationStatus = Literal["Open", "Under Review", "Closed"]

AI_DISCLAIMER = (
    "AI-generated initial assessment for review. "
    "Not a QA or regulatory decision."
)

# The 20 extraction fields defined by the assignment.
EXTRACTION_FIELDS: tuple[str, ...] = (
    "deviation_title",
    "deviation_description",
    "event_date",
    "reported_date",
    "department",
    "site",
    "product_name",
    "product_code",
    "batch_number",
    "manufacturing_stage",
    "process_parameter",
    "approved_range",
    "actual_value",
    "unit",
    "duration",
    "equipment",
    "equipment_id",
    "immediate_action",
    "potential_impact",
    "root_cause_indication",
)

REQUIRED_EXTRACTION_FIELDS: tuple[str, ...] = (
    "deviation_title",
    "deviation_description",
    "batch_number",
    "product_name",
    "process_parameter",
)

# Fields where a fabricated value is dangerous → grounding-checked strictly.
GROUNDING_CHECKED_FIELDS: tuple[str, ...] = (
    "batch_number",
    "product_name",
    "product_code",
    "equipment_id",
    "actual_value",
)

DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%b-%Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
)


def coerce_date(value: Any) -> datetime | None:
    """Lenient date coercion: unparseable → None (flagged downstream, never guessed)."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    text = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt)
            if "20" <= text[:2] or fmt.startswith("%Y"):
                return parsed
            return parsed
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# AI contracts
# ---------------------------------------------------------------------------


class ExtractedFields(BaseModel):
    """The 20 extracted fields. Everything nullable — AI must return null, never guess."""

    model_config = ConfigDict(extra="ignore")

    deviation_title: str | None = None
    deviation_description: str | None = None
    event_date: str | None = None
    reported_date: str | None = None
    department: str | None = None
    site: str | None = None
    product_name: str | None = None
    product_code: str | None = None
    batch_number: str | None = None
    manufacturing_stage: str | None = None
    process_parameter: str | None = None
    approved_range: str | None = None
    actual_value: str | None = None
    unit: str | None = None
    duration: str | None = None
    equipment: str | None = None
    equipment_id: str | None = None
    immediate_action: str | None = None
    potential_impact: str | None = None
    root_cause_indication: str | None = None

    @field_validator(
        "deviation_title",
        "deviation_description",
        "department",
        "site",
        "product_name",
        "product_code",
        "batch_number",
        "manufacturing_stage",
        "process_parameter",
        "approved_range",
        "actual_value",
        "unit",
        "duration",
        "equipment",
        "equipment_id",
        "immediate_action",
        "potential_impact",
        "root_cause_indication",
        mode="before",
    )
    @classmethod
    def _strip_strings(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            return v if v and v.lower() not in {"null", "none", "n/a", "unknown"} else None
        return v

    def as_dict(self) -> dict[str, str | None]:
        return {k: getattr(self, k) for k in EXTRACTION_FIELDS}


class ExtractionResult(BaseModel):
    data: ExtractedFields = Field(default_factory=ExtractedFields)
    confidence: dict[str, float] = Field(default_factory=dict)
    evidence: dict[str, str | None] = Field(default_factory=dict)

    def confidence_for(self, field: str) -> float:
        value = self.confidence.get(field, 0.0)
        try:
            return max(0.0, min(1.0, float(value)))
        except (TypeError, ValueError):
            return 0.0

    def average_confidence(self) -> float:
        populated = [
            self.confidence_for(f)
            for f in EXTRACTION_FIELDS
            if getattr(self.data, f) is not None
        ]
        if not populated:
            return 0.0
        return round(sum(populated) / len(populated), 3)


class ValidationReport(BaseModel):
    missing_information: list[str] = Field(default_factory=list)
    low_confidence: list[str] = Field(default_factory=list)
    ungrounded: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    critical_missing: bool = False


class ImpactAssessment(BaseModel):
    impact_level: ImpactLevel = "Medium"
    impact_areas: list[ImpactArea] = Field(default_factory=list)
    reason: str = ""
    supporting_factors: list[str] = Field(default_factory=list)
    disclaimer: str = AI_DISCLAIMER


class SeverityAssessment(BaseModel):
    recommended_severity: Severity = "Major"
    confidence: float = 0.5
    reason: str = ""
    factors: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)

    @field_validator("confidence")
    @classmethod
    def _clamp(cls, v: float) -> float:
        return max(0.0, min(1.0, float(v)))


class RefineProposal(BaseModel):
    field: str
    current_value: str | None = None
    proposed_value: str | None = None
    reason: str = ""


# ---------------------------------------------------------------------------
# API request/response — AI
# ---------------------------------------------------------------------------


class AiExtractRequest(BaseModel):
    text: str = Field(min_length=1)
    source_type: str | None = None
    request_id: str | None = None  # client correlation id (echoed in the response)

    @field_validator("text")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be empty")
        return v


class AiPipelineResponse(BaseModel):
    extraction: ExtractionResult
    validation: ValidationReport
    impact: ImpactAssessment | None = None
    severity: SeverityAssessment | None = None
    explanation: str | None = None
    provider: str
    model: str
    elapsed_ms: int
    errors: list[str] = Field(default_factory=list)
    request_id: str | None = None


class AssessImpactRequest(BaseModel):
    fields: ExtractedFields = Field(default_factory=ExtractedFields)
    raw_text: str | None = None


class AssessImpactResponse(BaseModel):
    impact: ImpactAssessment
    provider: str
    model: str


class AssessSeverityRequest(BaseModel):
    fields: ExtractedFields = Field(default_factory=ExtractedFields)
    validation: ValidationReport | None = None
    raw_text: str | None = None


class AssessSeverityResponse(BaseModel):
    severity: SeverityAssessment
    provider: str
    model: str


class RefineRequest(BaseModel):
    instruction: str = Field(min_length=3)
    current_fields: ExtractedFields = Field(default_factory=ExtractedFields)
    validation: ValidationReport | None = None
    raw_text: str | None = None

    @field_validator("instruction")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("instruction must not be empty")
        return v.strip()


class RefineResponse(BaseModel):
    proposals: list[RefineProposal] = Field(default_factory=list)
    message: str | None = None
    provider: str
    model: str


# ---------------------------------------------------------------------------
# API request/response — documents
# ---------------------------------------------------------------------------


class DocumentExtractText(BaseModel):
    text: str = Field(min_length=1)
    source_type: str | None = None

    @field_validator("text")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be empty")
        return v


class DocumentExtractResponse(BaseModel):
    text: str
    source_type: str
    char_count: int
    filename: str | None = None


# ---------------------------------------------------------------------------
# API request/response — deviations
# ---------------------------------------------------------------------------


class DeviationBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(min_length=1)
    description: str | None = None
    event_date: datetime | None = None
    reported_date: datetime | None = None
    department: str | None = None
    site: str | None = None
    product_name: str | None = None
    product_code: str | None = None
    batch_number: str | None = None
    manufacturing_stage: str | None = None
    process_parameter: str | None = None
    approved_range: str | None = None
    actual_value: str | None = None
    unit: str | None = None
    duration: str | None = None
    equipment: str | None = None
    equipment_id: str | None = None
    immediate_action: str | None = None
    potential_impact: str | None = None
    root_cause_indication: str | None = None

    final_severity: Severity
    ai_recommended_severity: Severity | None = None
    ai_impact_level: ImpactLevel | None = None
    ai_reason: str | None = None
    status: DeviationStatus = "Open"
    source_type: str | None = None
    ai_confidence_avg: float | None = None

    @field_validator("event_date", "reported_date", mode="before")
    @classmethod
    def _dates(cls, v: Any) -> datetime | None:
        return coerce_date(v)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title must not be empty")
        return v

    @field_validator(
        "description",
        "department",
        "site",
        "product_name",
        "product_code",
        "batch_number",
        "manufacturing_stage",
        "process_parameter",
        "approved_range",
        "actual_value",
        "unit",
        "duration",
        "equipment",
        "equipment_id",
        "immediate_action",
        "potential_impact",
        "root_cause_indication",
        mode="before",
    )
    @classmethod
    def _blank_to_none(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class DeviationCreate(DeviationBase):
    ai_assessment: "AiAssessmentPayload | None" = None


class DeviationUpdate(DeviationBase):
    """Full replacement payload (frontend always sends the whole form)."""

    final_severity: Severity


class AiAssessmentPayload(BaseModel):
    """AI pipeline output attached to a create/update call."""

    model_config = ConfigDict(extra="ignore")

    provider: str = "demo"
    model: str = ""
    extraction: ExtractionResult | None = None
    validation: ValidationReport | None = None
    impact: ImpactAssessment | None = None
    severity: SeverityAssessment | None = None
    explanation: str | None = None
    raw_text_excerpt: str | None = None


class AiAssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: str
    model: str
    extraction: dict[str, Any] | None = None
    confidence: dict[str, Any] | None = None
    evidence: dict[str, Any] | None = None
    validation: dict[str, Any] | None = None
    impact: dict[str, Any] | None = None
    severity: dict[str, Any] | None = None
    explanation: str | None = None
    created_at: datetime


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_type: str
    actor: str
    details: dict[str, Any] | None = None
    created_at: datetime


class DeviationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    deviation_number: str
    title: str
    description: str | None = None
    event_date: datetime | None = None
    reported_date: datetime | None = None
    department: str | None = None
    site: str | None = None
    product_name: str | None = None
    product_code: str | None = None
    batch_number: str | None = None
    manufacturing_stage: str | None = None
    process_parameter: str | None = None
    approved_range: str | None = None
    actual_value: str | None = None
    unit: str | None = None
    duration: str | None = None
    equipment: str | None = None
    equipment_id: str | None = None
    immediate_action: str | None = None
    potential_impact: str | None = None
    root_cause_indication: str | None = None
    ai_recommended_severity: Severity | None = None
    final_severity: Severity
    ai_impact_level: str | None = None
    ai_reason: str | None = None
    status: str
    source_type: str | None = None
    ai_confidence_avg: float | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class DeviationDetail(DeviationOut):
    ai_assessments: list[AiAssessmentOut] = Field(default_factory=list)
    audit_events: list[AuditEventOut] = Field(default_factory=list)


class DeviationListResponse(BaseModel):
    items: list[DeviationOut]
    total: int


DeviationCreate.model_rebuild()
