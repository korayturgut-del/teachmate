"""Dijital Öğretmen Asistanı — Cloud Brain API Gateway

Phase 1: Mock AI + Event Bus scaffold.
Phase 3: Gerçek DeepSeek + PaddleOCR entegrasyonu.
"""

import _path_setup  # noqa: F401  — repo kökünü sys.path'e ekler (packages.* importları için)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import exam, student, school, health, archive, review, pipeline, learning, privacy, maarif, maarif_advanced
from api.middleware.auth import AuthMiddleware
from api.middleware.otel import OpenTelemetryMiddleware
from routers import grading, ocr, routing
from core.config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle"""
    # Phase 1: Event Bus başlat
    from packages.event_bus.src import event_bus
    app.state.event_bus = event_bus
    yield
    event_bus.close()


app = FastAPI(
    title=settings.APP_NAME + " API",
    version=settings.VERSION,
    description="DÖA Cloud Brain — AI Gateway (FastAPI)",
    lifespan=lifespan,
)

# CORS — pydantic settings'ten
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuthMiddleware)
app.add_middleware(OpenTelemetryMiddleware)

# Routes
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(exam.router, prefix="/api/exams", tags=["Exams"])
app.include_router(student.router, prefix="/api/students", tags=["Students"])
app.include_router(school.router, prefix="/api/school", tags=["School"])
app.include_router(archive.router, prefix="/api/archive", tags=["Archive"])
app.include_router(review.router, prefix="/api/review", tags=["Review"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(learning.router, prefix="/api/learning", tags=["Learning"])
app.include_router(privacy.router, prefix="/api/privacy", tags=["Privacy/KVKK"])
app.include_router(maarif.router, prefix="/api/maarif", tags=["Maarif Performans"])
app.include_router(maarif_advanced.router, prefix="/api/maarif", tags=["Maarif Advanced (Kanıt Defteri)"])

# Phase 3: AI & OCR
app.include_router(grading.router, prefix="/api/grading", tags=["Grading"])
app.include_router(ocr.router, prefix="/api/ocr", tags=["OCR"])
app.include_router(routing.router, prefix="/api/routing", tags=["Routing"])


@app.get("/")
async def root():
    from services.deepseek import deepseek_grader
    from services.paddleocr import paddle_ocr
    deepseek_available = deepseek_grader.is_available
    paddleocr_available = paddle_ocr.is_available
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "mock": settings.DEEPSEEK_API_KEY == "",
        "phase": "3 — AI & OCR",
        "services": {
            "mock_ai": "active (fallback)",
            "deepseek": f"{'active' if deepseek_available else 'inactive (no API key)'}",
            "paddleocr": f"{'active' if paddleocr_available else 'inactive (not installed)'}",
            "event_bus": "active",
        },
    }
