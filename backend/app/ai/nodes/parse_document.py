"""Input normalization stage: cap length, strip control chars, detect email."""
import re

from app.ai.state import DeviationState
from app.services.document_service import normalize_pasted

_EMAIL_HEADERS = re.compile(r"^(from|to|cc|subject|date|sent|message-id):", re.I | re.M)


def parse_document(state: DeviationState) -> dict:
    stages = state.get("stages", []) + ["parse_document"]
    if state.get("failed"):
        return {"stages": stages}

    text = normalize_pasted(state.get("raw_text") or "")
    if not text.strip():
        return {
            "failed": True,
            "errors": state.get("errors", [])
            + ["The document contained no readable text."],
            "stages": stages,
        }

    source_type = state.get("source_type") or "text"
    if source_type == "text" and _EMAIL_HEADERS.search(text):
        source_type = "email"
    return {"raw_text": text, "source_type": source_type, "stages": stages}
