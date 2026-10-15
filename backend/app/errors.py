"""Application error types → uniform {detail:{message, code}} responses."""


class AppError(Exception):
    status_code: int = 400
    code: str = "bad_request"

    def __init__(self, message: str, status_code: int | None = None, code: str | None = None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code


class DocumentError(AppError):
    code = "document_error"
    status_code = 422


class UnsupportedFileType(DocumentError):
    code = "unsupported_file_type"
    status_code = 415


class FileTooLarge(DocumentError):
    code = "file_too_large"
    status_code = 413


class EmptyDocument(DocumentError):
    code = "empty_document"
    status_code = 422


class AiUnavailable(AppError):
    code = "ai_unavailable"
    status_code = 502


class AiRateLimited(AiUnavailable):
    """Groq rate limited us (429) after the bounded retry budget."""

    code = "ai_rate_limited"
    status_code = 429


class AiInvalidResponse(AiUnavailable):
    """Provider answered 200 but the content failed JSON/schema validation."""

    code = "ai_invalid_response"
    status_code = 502


class AiTimeout(AppError):
    code = "ai_timeout"
    status_code = 504


class NotFound(AppError):
    code = "not_found"
    status_code = 404
