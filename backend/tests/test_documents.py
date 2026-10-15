"""Document extraction tests: formats, guards, and error contracts."""
from pathlib import Path

import pytest

from app.config import settings


def test_extract_json_text(client, sample_text):
    res = client.post("/api/documents/extract", json={"text": sample_text})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source_type"] == "text"
    assert body["char_count"] > 100
    assert "API-240617" in body["text"]
    assert body["filename"] is None


def test_extract_email_detected(client, sample_email):
    res = client.post("/api/documents/extract", json={"text": sample_email})
    assert res.status_code == 200, res.text
    assert res.json()["source_type"] == "email"


def test_extract_pdf_upload(client, sample_pdf_path: Path):
    with open(sample_pdf_path, "rb") as fh:
        res = client.post(
            "/api/documents/extract",
            files={"file": ("sample-deviation.pdf", fh, "application/pdf")},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source_type"] == "pdf"
    assert "API-240617" in body["text"]


def test_extract_docx_upload(client, sample_docx_path: Path):
    with open(sample_docx_path, "rb") as fh:
        res = client.post(
            "/api/documents/extract",
            files={"file": ("sample-deviation.docx", fh, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source_type"] == "docx"
    assert "86" in body["text"]


def test_extract_txt_upload(client, sample_text):
    res = client.post(
        "/api/documents/extract",
        files={"file": ("note.txt", sample_text.encode("utf-8"), "text/plain")},
    )
    assert res.status_code == 200, res.text
    assert res.json()["source_type"] == "txt"


def test_unsupported_extension_rejected(client):
    res = client.post(
        "/api/documents/extract",
        files={"file": ("evil.exe", b"MZ\x90\x00", "application/octet-stream")},
    )
    assert res.status_code == 415
    assert res.json()["detail"]["code"] == "unsupported_file_type"


def test_fake_pdf_rejected_by_magic_bytes(client):
    res = client.post(
        "/api/documents/extract",
        files={"file": ("fake.pdf", b"not a pdf at all", "application/pdf")},
    )
    assert res.status_code == 415
    assert res.json()["detail"]["code"] == "unsupported_file_type"


def test_empty_text_rejected(client):
    res = client.post("/api/documents/extract", json={"text": "   "})
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert isinstance(detail, list) and detail[0]["type"] == "value_error"


def test_oversize_file_rejected(client, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 0)
    res = client.post(
        "/api/documents/extract",
        files={"file": ("big.txt", b"hello world", "text/plain")},
    )
    assert res.status_code == 413
    assert res.json()["detail"]["code"] == "file_too_large"


@pytest.mark.parametrize("text_hint,expected", [({"source_type": "email"}, "email"), ({}, "text")])
def test_text_hint_passthrough(client, text_hint, expected):
    res = client.post(
        "/api/documents/extract", json={"text": "Plain report body", **text_hint}
    )
    assert res.status_code == 200
    assert res.json()["source_type"] == expected
