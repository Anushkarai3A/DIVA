"""AI pipeline tests: DemoProvider determinism, validation/grounding, endpoints.

DEMO_MODE=true in conftest — no network, no API key, fully deterministic.
"""
import pytest
from fastapi.testclient import TestClient

from app.ai.nodes.validate import compute_validation
from app.ai.provider import DemoProvider
from app.errors import AiUnavailable
from app.schemas.deviation import (
    EXTRACTION_FIELDS,
    REQUIRED_EXTRACTION_FIELDS,
    ExtractedFields,
    ExtractionResult,
    ValidationReport,
)
from app.services import ai_service


def _extract(client: TestClient, text: str, source_type: str | None = None) -> dict:
    response = client.post(
        "/api/ai/extract-deviation",
        json={"text": text, "source_type": source_type},
    )
    assert response.status_code == 200, response.text
    return response.json()


# ---------------------------------------------------------------------------
# Full pipeline — sample document
# ---------------------------------------------------------------------------


def test_extract_sample_full_pipeline(client: TestClient, sample_text: str) -> None:
    body = _extract(client, sample_text, "txt")

    assert body["provider"] == "demo"
    assert body["elapsed_ms"] >= 0

    data = body["extraction"]["data"]
    confidence = body["extraction"]["confidence"]

    # Grounded facts from the sample document.
    assert data["batch_number"] == "API-240617"
    assert data["actual_value"] == "86"
    assert data["equipment_id"] == "R-204"
    assert data["product_name"] == "API-Compound-X"
    assert data["process_parameter"] == "Reactor temperature"
    assert data["approved_range"] == "78-82"
    assert data["unit"] == "°C"
    assert data["duration"] == "12 minutes"

    # Never invents: product code is not stated in the document.
    assert data["product_code"] is None
    assert data["root_cause_indication"] is None
    assert confidence["product_code"] == 0.0
    assert confidence["batch_number"] >= 0.9

    validation = body["validation"]
    assert validation["critical_missing"] is False
    assert validation["missing_information"] == []
    assert validation["ungrounded"] == []

    assert body["impact"] is not None
    assert body["impact"]["impact_level"] == "High"
    assert body["impact"]["disclaimer"]  # mandatory disclaimer present

    assert body["severity"] is not None
    assert body["severity"]["recommended_severity"] == "Major"
    assert 0.5 <= body["severity"]["confidence"] <= 1.0
    assert body["severity"]["missing_information"] == []

    assert body["explanation"] and "Major" in body["explanation"]


def test_extract_sample_email(client: TestClient, sample_email: str) -> None:
    body = _extract(client, sample_email)

    data = body["extraction"]["data"]
    assert data["batch_number"] == "API-240617"
    assert data["actual_value"] == "86"
    assert data["equipment_id"] == "R-204"
    assert data["product_code"] is None
    # Narrative email has no "Product:" label — null, not guessed.
    assert data["product_name"] is None

    assert body["validation"]["critical_missing"] is False
    assert "product_name" in body["validation"]["missing_information"]
    assert body["severity"] is not None
    assert body["severity"]["recommended_severity"] == "Major"


# ---------------------------------------------------------------------------
# Anti-hallucination: irrelevant input
# ---------------------------------------------------------------------------


def test_irrelevant_input_yields_nulls_not_fabrications(
    client: TestClient,
) -> None:
    body = _extract(
        client,
        "Team lunch was at the cafeteria. Nothing related to manufacturing happened today.",
    )

    data = body["extraction"]["data"]
    confidence = body["extraction"]["confidence"]
    for field in EXTRACTION_FIELDS:
        assert data[field] is None, f"{field} should be null, got {data[field]!r}"
        assert confidence[field] == 0.0, f"{field} confidence must be 0.0"

    assert body["validation"]["critical_missing"] is True
    assert set(body["validation"]["missing_information"]) == set(
        REQUIRED_EXTRACTION_FIELDS
    )
    assert body["impact"] is None
    assert body["severity"] is None
    assert body["explanation"] and "Insufficient information" in body["explanation"]


# ---------------------------------------------------------------------------
# Validation rules (unit level)
# ---------------------------------------------------------------------------


def test_grounding_check_cuts_confidence() -> None:
    fields = ExtractedFields(
        deviation_title="Temperature excursion",
        deviation_description="Reactor temperature above range.",
        batch_number="FAKE-999",
        product_name="Unlisted-Product",
        process_parameter="Reactor temperature",
    )
    extracted = ExtractionResult(
        data=fields,
        confidence={field: 0.95 for field in EXTRACTION_FIELDS},
    )

    report = compute_validation(extracted, "Some unrelated source text.")

    assert "batch_number" in report.ungrounded
    assert "product_name" in report.ungrounded
    assert extracted.confidence["batch_number"] <= 0.4
    assert extracted.confidence["product_name"] <= 0.4
    # Not grounding-checked fields keep their confidence.
    assert extracted.confidence["deviation_title"] == 0.95
    assert report.critical_missing is False


def test_grounding_passes_when_value_in_source() -> None:
    fields = ExtractedFields(batch_number="API-240617", product_name="API-Compound-X")
    extracted = ExtractionResult(
        data=fields, confidence={"batch_number": 0.95, "product_name": 0.9}
    )

    report = compute_validation(
        extracted, "Batch Number: API-240617, Product: API-Compound-X"
    )

    assert report.ungrounded == []
    assert extracted.confidence["batch_number"] == 0.95
    # batch + product are present (2 of 5 required) -> not critical, 3 still missing
    assert report.critical_missing is False
    assert set(report.missing_information) == {
        "deviation_title",
        "deviation_description",
        "process_parameter",
    }


def test_all_required_missing_is_critical() -> None:
    report = compute_validation(ExtractionResult(), "")
    assert report.critical_missing is True
    assert set(report.missing_information) == set(REQUIRED_EXTRACTION_FIELDS)


# ---------------------------------------------------------------------------
# Partial re-assess endpoints
# ---------------------------------------------------------------------------


def test_partial_assess_endpoints(
    client: TestClient, sample_text: str
) -> None:
    body = _extract(client, sample_text, "txt")
    fields = body["extraction"]["data"]

    impact_response = client.post(
        "/api/ai/assess-impact", json={"fields": fields, "raw_text": sample_text}
    )
    assert impact_response.status_code == 200, impact_response.text
    impact_body = impact_response.json()
    assert impact_body["provider"] == "demo"
    assert impact_body["impact"]["impact_level"] in ("Low", "Medium", "High", "Critical")
    assert impact_body["impact"]["reason"]

    severity_response = client.post(
        "/api/ai/assess-severity",
        json={"fields": fields, "raw_text": sample_text},
    )
    assert severity_response.status_code == 200, severity_response.text
    severity_body = severity_response.json()
    assert severity_body["severity"]["recommended_severity"] in (
        "Minor",
        "Major",
        "Critical",
    )
    # Validation gaps flow through even when validation is not supplied.
    assert isinstance(severity_body["severity"]["missing_information"], list)


# ---------------------------------------------------------------------------
# Refine: proposals, never auto-applied
# ---------------------------------------------------------------------------


def test_refine_proposes_grounded_correction(
    client: TestClient, sample_text: str
) -> None:
    response = client.post(
        "/api/ai/refine",
        json={
            "instruction": "Fix the batch number",
            "current_fields": {"batch_number": "WRONG-1"},
            "raw_text": sample_text,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "demo"

    batch_proposals = [p for p in body["proposals"] if p["field"] == "batch_number"]
    assert batch_proposals, f"expected a batch_number proposal, got {body}"
    proposal = batch_proposals[0]
    assert proposal["current_value"] == "WRONG-1"
    assert proposal["proposed_value"] == "API-240617"
    assert proposal["reason"]


def test_refine_rephrase_proposes_description_rewrite(client: TestClient) -> None:
    response = client.post(
        "/api/ai/refine",
        json={
            "instruction": "rephrase this professionally",
            "current_fields": {
                "deviation_description": "temp went above the range during the run"
            },
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    descriptions = [
        p for p in body["proposals"] if p["field"] == "deviation_description"
    ]
    assert descriptions, f"expected a description proposal, got {body}"
    assert descriptions[0]["proposed_value"] != descriptions[0]["current_value"]
    assert descriptions[0]["proposed_value"].endswith(".")


def test_refine_unchanged_description_reports_message(client: TestClient) -> None:
    response = client.post(
        "/api/ai/refine",
        json={
            "instruction": "rephrase this professionally",
            "current_fields": {
                "deviation_description": "Reactor temperature exceeded the approved range."
            },
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["proposals"] == []
    assert body["message"]


def test_refine_missing_information_question(client: TestClient) -> None:
    response = client.post(
        "/api/ai/refine",
        json={
            "instruction": "What information is missing?",
            "current_fields": {},
            "validation": ValidationReport(
                missing_information=["product_code"],
                critical_missing=False,
            ).model_dump(),
            "raw_text": "Batch Number: API-240617. Reactor temperature reached 86.",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["proposals"] == []
    assert body["message"] and "product_code" in body["message"]


# ---------------------------------------------------------------------------
# Error contracts
# ---------------------------------------------------------------------------


def test_empty_text_returns_422(client: TestClient) -> None:
    response = client.post("/api/ai/extract-deviation", json={"text": ""})
    assert response.status_code == 422


def test_provider_failure_returns_502(client: TestClient, monkeypatch) -> None:
    def boom(self, system, user, repair_note=None):
        raise AiUnavailable("provider exploded")

    monkeypatch.setattr(DemoProvider, "complete_json", boom)

    response = client.post(
        "/api/ai/extract-deviation", json={"text": "Batch Number: API-240617"}
    )
    assert response.status_code == 502
    detail = response.json()["detail"]
    assert detail["code"] == "ai_unavailable"
    assert "provider exploded" in detail["message"]


# ---------------------------------------------------------------------------
# Save contract: pipeline output attaches to a created deviation
# ---------------------------------------------------------------------------


def test_pipeline_output_saves_with_assessment(
    client: TestClient, sample_text: str
) -> None:
    body = _extract(client, sample_text, "txt")
    data = body["extraction"]["data"]

    create_response = client.post(
        "/api/deviations",
        json={
            "title": data["deviation_title"],
            "description": data["deviation_description"],
            "batch_number": data["batch_number"],
            "product_name": data["product_name"],
            "process_parameter": data["process_parameter"],
            "actual_value": data["actual_value"],
            "final_severity": body["severity"]["recommended_severity"],
            "source_type": "txt",
            "ai_assessment": {
                "provider": body["provider"],
                "model": body["model"],
                "extraction": body["extraction"],
                "validation": body["validation"],
                "impact": body["impact"],
                "severity": body["severity"],
                "explanation": body["explanation"],
                "raw_text_excerpt": sample_text[:500],
            },
        },
    )
    assert create_response.status_code == 201, create_response.text
    created = create_response.json()
    assert created["deviation_number"].startswith("DEV-")
    assert created["ai_recommended_severity"] == "Major"
    assert created["ai_impact_level"] == "High"
    assert created["ai_confidence_avg"] > 0

    detail_response = client.get(f"/api/deviations/{created['id']}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert len(detail["ai_assessments"]) == 1
    assessment = detail["ai_assessments"][0]
    assert assessment["provider"] == "demo"
    assert assessment["extraction"]["batch_number"] == "API-240617"
    event_types = [event["event_type"] for event in detail["audit_events"]]
    assert "ai_extracted" in event_types
    assert "created" in event_types


# ---------------------------------------------------------------------------
# DemoProvider task routing
# ---------------------------------------------------------------------------


def test_demo_provider_routes_extract_task() -> None:
    provider = DemoProvider()
    result = provider.complete_json(
        "TASK=EXTRACT\nirrelevant", "<document>\nBatch Number: API-240617\n</document>"
    )
    assert result["data"]["batch_number"] == "API-240617"
    assert set(result.keys()) == {"data", "confidence", "evidence"}


def test_demo_provider_rejects_unknown_task() -> None:
    provider = DemoProvider()
    with pytest.raises(AiUnavailable):
        provider.complete_json("TASK=BOGUS", "<document>x</document>")


def test_service_module_exposes_graph() -> None:
    assert ai_service.GRAPH is not None
