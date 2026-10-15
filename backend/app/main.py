"""FastAPI application entry point."""
import logging
import uuid

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError

from app.api import ai, deviations, documents
from app.config import settings
from app.database import init_db
from app.errors import AppError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("diva")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered deviation intake for API pharmaceutical manufacturing.",
    version="1.0.0",
    lifespan=lifespan,
)

# Explicit production/configured origin + any localhost/127.0.0.1 dev port
# (Vite auto-increments: 5173, 5174, ...). CORS stays scoped to local dev.
_LOCAL_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_origin_regex=_LOCAL_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(PydanticValidationError)
async def pydantic_validation_handler(
    request: Request, exc: PydanticValidationError
) -> JSONResponse:
    """Manual model_validate() inside handlers → same 422 shape as FastAPI's own."""
    return JSONResponse(
        status_code=422, content={"detail": jsonable_encoder(exc.errors())}
    )


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Typed application errors → {detail:{message, code}} with the right status."""
    logger.info("AppError %s on %s: %s", exc.code, request.url.path, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": {"message": exc.message, "code": exc.code}},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Never leak stack traces to the client; log them server-side."""
    request_id = uuid.uuid4().hex[:12]
    logger.exception("[%s] Unhandled error on %s %s", request_id, request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "message": "An unexpected error occurred. Please try again.",
                "code": "internal_error",
                "request_id": request_id,
            }
        },
    )


@app.get("/api/health", tags=["system"])
def health() -> dict:
    from sqlalchemy import text

    from app.database import engine

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "up"
    except Exception as exc:
        logger.warning("Health check: database down (%s)", exc)
        db_status = "down"
    return {"status": "ok" if db_status == "up" else "degraded", "db": db_status}


@app.get("/api/config", tags=["system"])
def config() -> dict:
    return {
        "demo_mode": settings.DEMO_MODE,
        "model": settings.GROQ_MODEL,
        "provider": settings.active_provider,
        "max_upload_mb": settings.MAX_UPLOAD_MB,
    }


app.include_router(documents.router)
app.include_router(ai.router)
app.include_router(deviations.router)
