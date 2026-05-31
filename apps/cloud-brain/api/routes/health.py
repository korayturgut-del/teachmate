"""Health check endpoint — Phase 1 gerçek implement."""
from fastapi import APIRouter
import os

router = APIRouter()

APP_VERSION = os.getenv("DOA_VERSION", "1.0.0-doa")


@router.get("/health")
async def health_check():
    """Sistem sağlık durumu"""
    return {
        "status": "ok",
        "app": "Dijital Öğretmen Asistanı",
        "version": APP_VERSION,
        "mock": True,
        "message": "Phase 1 scaffold. Mock AI aktif."
    }


@router.get("/status")
async def detailed_status():
    """Detaylı sistem durumu"""
    return {
        "status": "operational",
        "version": APP_VERSION,
        "services": {
            "mock_ai": "active",
            "deepseek": "inactive (Phase 3)",
            "ocr": "inactive (Phase 3)",
            "event_bus": "active",
        },
        "mock": True,
    }
