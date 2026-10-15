"""Per-request correlation IDs + stage logging for the AI pipeline.

Every pipeline request gets an extraction id (client-supplied or generated).
All provider retries, validation steps and response events are logged as:

    2026-09-27 17:00:00 INFO diva.pipeline [ab12cd34] Groq attempt 1/3
"""
import logging
import uuid
from contextvars import ContextVar

logger = logging.getLogger("diva.pipeline")

_id: ContextVar[str] = ContextVar("diva_extraction_id", default="-")
_retry_notes: ContextVar[list[str] | None] = ContextVar("diva_retry_notes", default=None)


def start(request_id: str | None = None) -> str:
    """Bind a fresh extraction id to the current context and log receipt."""
    sid = (request_id or "").strip()[:64] or uuid.uuid4().hex[:8]
    _id.set(sid)
    _retry_notes.set([])
    stage("Frontend request received")
    return sid


def current() -> str:
    return _id.get()


def stage(message: str, *args: object) -> None:
    logger.info("[%s] " + message, current(), *args)


def add_retry_note(note: str) -> None:
    """Record a human-readable retry event (drained into the API response)."""
    notes = _retry_notes.get()
    if notes is not None and note not in notes:
        notes.append(note)


def drain_retry_notes() -> list[str]:
    notes = _retry_notes.get()
    if not notes:
        return []
    _retry_notes.set([])
    return list(notes)
