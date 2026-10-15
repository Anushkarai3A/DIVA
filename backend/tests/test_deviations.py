"""Deviation CRUD: contract, audit events, numbering, errors."""


def _payload(**overrides):
    base = {
        "title": "Reactor temperature excursion during reaction stage",
        "description": "Temperature reached 86 C against an approved 78-82 C range.",
        "final_severity": "Major",
        "ai_recommended_severity": "Major",
        "ai_impact_level": "High",
        "batch_number": "API-240617",
        "product_name": "API-Compound-X",
        "process_parameter": "Reactor temperature",
        "event_date": "2024-06-17",
        "status": "Open",
    }
    base.update(overrides)
    return base


def test_create_returns_201_and_number(client):
    res = client.post("/api/deviations", json=_payload())
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["deviation_number"].startswith("DEV-")
    assert body["final_severity"] == "Major"
    assert body["event_date"].startswith("2024-06-17")
    assert body["id"]


def test_create_requires_final_severity(client):
    payload = _payload()
    payload.pop("final_severity")
    res = client.post("/api/deviations", json=payload)
    assert res.status_code == 422
    assert isinstance(res.json()["detail"], list)


def test_deviation_numbers_are_unique(client):
    first = client.post("/api/deviations", json=_payload()).json()
    second = client.post("/api/deviations", json=_payload(title="Second event")).json()
    assert first["deviation_number"] != second["deviation_number"]


def test_get_detail_includes_audit_trail(client):
    created = client.post("/api/deviations", json=_payload()).json()
    res = client.get(f"/api/deviations/{created['id']}")
    assert res.status_code == 200
    detail = res.json()
    assert detail["audit_events"][0]["event_type"] == "created"
    assert detail["ai_assessments"] == []


def test_update_overrides_severity_and_audits_it(client):
    created = client.post("/api/deviations", json=_payload()).json()
    res = client.put(
        f"/api/deviations/{created['id']}", json=_payload(final_severity="Critical")
    )
    assert res.status_code == 200
    assert res.json()["final_severity"] == "Critical"

    detail = client.get(f"/api/deviations/{created['id']}").json()
    events = [e["event_type"] for e in detail["audit_events"]]
    # Severity-only change gets a dedicated event, not a generic field_edited.
    assert events == ["created", "severity_overridden"]
    severity_event = next(
        e for e in detail["audit_events"] if e["event_type"] == "severity_overridden"
    )
    assert severity_event["details"]["from"] == "Major"
    assert severity_event["details"]["to"] == "Critical"


def test_update_edits_fields_and_audits_diff(client):
    created = client.post("/api/deviations", json=_payload()).json()
    res = client.put(
        f"/api/deviations/{created['id']}",
        json=_payload(duration="12 minutes", description="Edited by reviewer."),
    )
    assert res.status_code == 200
    assert res.json()["duration"] == "12 minutes"

    detail = client.get(f"/api/deviations/{created['id']}").json()
    field_event = next(
        e for e in detail["audit_events"] if e["event_type"] == "field_edited"
    )
    assert set(field_event["details"].keys()) == {"duration", "description"}
    assert field_event["details"]["duration"]["from"] is None
    assert field_event["details"]["duration"]["to"] == "12 minutes"


def test_list_search_and_total(client):
    client.post("/api/deviations", json=_payload())
    client.post("/api/deviations", json=_payload(title="Unrelated event", batch_number="OTHER-1"))
    res = client.get("/api/deviations", params={"search": "API-240617"})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["batch_number"] == "API-240617"


def test_list_severity_filter(client):
    client.post("/api/deviations", json=_payload())
    client.post("/api/deviations", json=_payload(title="Critical one", final_severity="Critical"))
    res = client.get("/api/deviations", params={"severity": "Critical"})
    assert res.json()["total"] == 1


def test_get_missing_returns_404(client):
    res = client.get("/api/deviations/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "not_found"


def test_update_missing_returns_404(client):
    res = client.put(
        "/api/deviations/00000000-0000-0000-0000-000000000000", json=_payload()
    )
    assert res.status_code == 404


def test_blank_title_rejected(client):
    res = client.post("/api/deviations", json=_payload(title="   "))
    assert res.status_code == 422


def test_invalid_severity_enum_rejected(client):
    res = client.post("/api/deviations", json=_payload(final_severity="Extreme"))
    assert res.status_code == 422
