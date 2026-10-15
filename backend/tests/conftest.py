"""Shared fixtures: SQLite-backed app client (no network, no Docker, no API key).

Environment MUST be set before importing app.* (settings are read at import).
"""
import os
import tempfile
from pathlib import Path

_TEST_DB = Path(tempfile.mkdtemp(prefix="diva_test_")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["DEMO_MODE"] = "true"
os.environ["GROQ_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

SAMPLE_DIR = Path(__file__).resolve().parents[2] / "sample-data"


@pytest.fixture(autouse=True)
def clean_db():
    """Every test starts from empty tables."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def sample_text() -> str:
    return (SAMPLE_DIR / "sample-deviation.txt").read_text(encoding="utf-8")


@pytest.fixture()
def sample_email() -> str:
    return (SAMPLE_DIR / "sample-deviation-email.txt").read_text(encoding="utf-8")


@pytest.fixture()
def sample_pdf_path() -> Path:
    return SAMPLE_DIR / "sample-deviation.pdf"


@pytest.fixture()
def sample_docx_path() -> Path:
    return SAMPLE_DIR / "sample-deviation.docx"
