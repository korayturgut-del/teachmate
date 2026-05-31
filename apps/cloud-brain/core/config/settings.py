"""Dijital Öğretmen Asistanı — Core Configuration

Phase 2: Saf pydantic-settings field syntax'ı.
os.getenv() kullanılmaz — tüm değerler pydantic tarafından .env'den okunur.

ADR: Hardcoded credential yasak. check-credentials.sh ile doğrulanır.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """DÖA uygulama ayarları — .env'den otomatik yüklenir."""

    # ── Uygulama ──────────────────────────────────────────────
    APP_NAME: str = "Dijital Öğretmen Asistanı"
    VERSION: str = "1.0.0-doa"
    DEBUG: bool = False

    # ── Veritabanı (yerel SQLite) ─────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./doa_local.db"

    # ── DeepSeek API (Phase 3+) ───────────────────────────────
    DEEPSEEK_API_KEY: str = ""

    # ── Auth ──────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 72

    # ── CORS ──────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    # ── Rate Limiting ─────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    # ── File Upload ───────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: List[str] = [
        ".pdf", ".jpg", ".jpeg", ".png", ".tiff"
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
