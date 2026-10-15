"""Document upload/extraction endpoints."""
from fastapi import APIRouter, File, Request, UploadFile

from app.errors import DocumentError
from app.schemas.deviation import DocumentExtractResponse, DocumentExtractText
from app.services import document_service

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/extract", response_model=DocumentExtractResponse)
async def extract_document(request: Request, file: UploadFile | None = File(None)):
    """Accept multipart file upload OR a JSON body {"text": "..."}."""
    content_type = (request.headers.get("content-type") or "").lower()

    if file is not None and file.filename:
        result = document_service.extract_upload(file)
        return DocumentExtractResponse(
            text=result["text"],
            source_type=result["source_type"],
            char_count=len(result["text"]),
            filename=result["filename"],
        )

    if content_type.startswith("application/json"):
        body = await request.json()
        payload = DocumentExtractText.model_validate(body)
        result = document_service.extract_text_content(payload.text, payload.source_type)
        return DocumentExtractResponse(
            text=result["text"],
            source_type=result["source_type"],
            char_count=len(result["text"]),
            filename=None,
        )

    raise DocumentError("Provide a file upload (multipart/form-data) or JSON {\"text\"}.")
