"""Rate-limit retry, typed AI errors, and request_id correlation.

All tests run offline: DEMO_MODE=true in conftest; GroqProvider unit tests use
a fake LLM object (no langchain import, no network, no API key).
"""
import json
import types

import pytest
from fastapi.testclient import TestClient

from app import tracing
from app.ai import provider as provider_mod
from app.ai.provider import GroqProvider
from app.errors import AiInvalidResponse, AiRateLimited, AiTimeout


class Rate429(Exception):
    status_code = 429


class _FakeLLM:
    """Scripted invoke(): pops queued items; repeats the last one forever."""

    def __init__(self, responses):
        self.calls = 0
        self._queue = list(responses)

    def invoke(self, _messages):
        item = self._queue.pop(0) if len(self._queue) > 1 else self._queue[0]
        self.calls += 1
        if isinstance(item, Exception):
            raise item
        return types.SimpleNamespace(content=item)


def _groq_provider(responses) -> GroqProvider:
    provider = GroqProvider.__new__(GroqProvider)
    provider.model = "test-model"
    provider._llm = _FakeLLM(responses)
    return provider


class _FailingProvider:
    """Stands in for Groq: complete_json raises whatever `boom` raises."""

    name = "groq"
    model = "test-model"

    def __init__(self, boom):
        self._boom = boom

    def complete_json(self, system, user, repair_note=None):
        return self._boom(None, system, user, repair_note)


def _failing_provider(boom) -> _FailingProvider:
    return _FailingProvider(boom)


def _patch_pipeline_provider(monkeypatch, boom) -> None:
    monkeypatch.setattr(
        "app.ai.nodes.extract.get_provider", lambda name=None: _failing_provider(boom)
    )
    monkeypatch.setattr(
        "app.services.ai_service.get_provider", lambda name=None: _failing_provider(boom)
    )


def _record_sleeps(monkeypatch) -> list[float]:
    sleeps: list[float] = []
    monkeypatch.setattr(provider_mod, "time", types.SimpleNamespace(sleep=sleeps.append))
    return sleeps


def _post_pipeline(client: TestClient, **extra) -> tuple[int, dict]:
    response = client.post(
        "/api/ai/extract-deviation",
        json={"text": "Reactor R-204 ran at 86 C for 12 minutes.", **extra},
    )
    return response.status_code, response.json()["detail"]


# ---------------------------------------------------------------------------
# Bounded 429 retry inside GroqProvider.complete_json
# ---------------------------------------------------------------------------


def test_rate_limited_retries_then_succeeds(monkeypatch) -> None:
    sleeps = _record_sleeps(monkeypatch)
    tracing.start("retry-ok")
    provider = _groq_provider([Rate429("429 rate limited"), json.dumps({"ok": True})])

    out = provider.complete_json("sys", "user")

    assert out == {"ok": True}
    assert provider._llm.calls == 2
    assert sleeps == [2.0]
    notes = tracing.drain_retry_notes()
    assert notes and "rate limited" in notes[0].lower() and "attempt 2" in notes[0]


def test_rate_limit_exhaustion_raises_typed_error(monkeypatch) -> None:
    sleeps = _record_sleeps(monkeypatch)
    tracing.start("retry-exhaust")
    provider = _groq_provider([Rate429("429 too many requests")])

    with pytest.raises(AiRateLimited) as exc_info:
        provider.complete_json("sys", "user")

    assert exc_info.value.code == "ai_rate_limited"
    assert exc_info.value.status_code == 429
    assert provider._llm.calls == 3
    assert sleeps == [2.0, 5.0]
    assert tracing.drain_retry_notes() == []


def test_retry_after_header_honored(monkeypatch) -> None:
    sleeps = _record_sleeps(monkeypatch)
    tracing.start("retry-after")

    class Rate429WithHeader(Rate429):
        def __init__(self):
            super().__init__("429 rate limited")
            self.response = types.SimpleNamespace(headers={"retry-after": "7"})

    provider = _groq_provider([Rate429WithHeader(), json.dumps({"ok": 1})])
    provider.complete_json("sys", "user")

    assert sleeps == [7.0]


def test_retry_after_capped_at_30s(monkeypatch) -> None:
    sleeps = _record_sleeps(monkeypatch)
    tracing.start("retry-after-cap")

    class Rate429HugeWait(Rate429):
        def __init__(self):
            super().__init__("429 rate limited")
            self.response = types.SimpleNamespace(headers={"retry-after": "120"})

    provider = _groq_provider([Rate429HugeWait(), json.dumps({"ok": 1})])
    provider.complete_json("sys", "user")

    assert sleeps == [30.0]


def test_non_rate_limit_errors_do_not_retry(monkeypatch) -> None:
    sleeps = _record_sleeps(monkeypatch)
    tracing.start("no-retry")
    provider = _groq_provider([AiTimeout("AI request timed out after 45s.")])

    with pytest.raises(AiTimeout):
        provider.complete_json("sys", "user")

    assert provider._llm.calls == 1
    assert sleeps == []


# ---------------------------------------------------------------------------
# Endpoint-level categories (pipeline raises typed errors -> HTTP status)
# ---------------------------------------------------------------------------


def test_rate_limit_exhaustion_returns_429(client, monkeypatch) -> None:
    def boom(self, system, user, repair_note=None):
        raise AiRateLimited(
            "The AI service is rate limited. This request was retried 3 times without success."
        )

    _patch_pipeline_provider(monkeypatch, boom)

    status, detail = _post_pipeline(client)

    assert status == 429
    assert detail["code"] == "ai_rate_limited"
    assert "rate limited" in detail["message"].lower()


def test_timeout_returns_504(client, monkeypatch) -> None:
    def boom(self, system, user, repair_note=None):
        raise AiTimeout("AI request timed out after 45s.")

    _patch_pipeline_provider(monkeypatch, boom)

    status, detail = _post_pipeline(client)

    assert status == 504
    assert detail["code"] == "ai_timeout"


def test_no_silent_demo_fallback_on_rate_limit(client, monkeypatch) -> None:
    """A failing Groq path must surface 429 - never re-run as Demo and return 200."""

    def boom(self, system, user, repair_note=None):
        raise AiRateLimited("The AI service is rate limited.")

    # DemoProvider stays SUCCESSFUL (default): a silent fallback would give 200/demo.
    _patch_pipeline_provider(monkeypatch, boom)

    status, detail = _post_pipeline(client)

    assert status == 429, "pipeline must not silently switch to the demo provider"
    assert detail["code"] == "ai_rate_limited"


def test_invalid_json_content_is_502_ai_invalid_response(client, monkeypatch) -> None:
    def boom(self, system, user, repair_note=None):
        raise AiInvalidResponse("AI returned a response that was not valid JSON.")

    _patch_pipeline_provider(monkeypatch, boom)

    status, detail = _post_pipeline(client)

    assert status == 502
    assert detail["code"] == "ai_invalid_response"


def test_parse_json_rejects_non_json() -> None:
    with pytest.raises(AiInvalidResponse):
        provider_mod._parse_json("Sorry, I cannot help with that.")


def test_provider_429_message_is_detailed(client, monkeypatch) -> None:
    """Frontend shows detail['message'] - it must name the category, not say 'cannot reach'."""

    def boom(self, system, user, repair_note=None):
        raise AiRateLimited("The AI service is rate limited. Please retry in a moment.")

    _patch_pipeline_provider(monkeypatch, boom)

    _status, detail = _post_pipeline(client, request_id="rid-429-msg")

    assert "rate limited" in detail["message"].lower()
    assert "cannot reach" not in detail["message"].lower()
    assert "demo" not in detail["message"].lower()


# ---------------------------------------------------------------------------
# request_id correlation
# ---------------------------------------------------------------------------


def test_request_id_echoed_on_success(client) -> None:
    response = client.post(
        "/api/ai/extract-deviation",
        json={"text": "Batch API-240617 deviation on reactor R-204.", "request_id": "rid-abc123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["request_id"] == "rid-abc123"
    assert body["errors"] == []


def test_request_id_generated_when_missing(client) -> None:
    response = client.post(
        "/api/ai/extract-deviation", json={"text": "Batch API-240617 on R-204."}
    )
    assert response.status_code == 200
    assert response.json()["request_id"]
