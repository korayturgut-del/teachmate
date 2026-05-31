"""Dijital Öğretmen Asistanı — Model Routing (AI Provider Selector)

Phase 3: Hangi AI modelinin kullanılacağını seçen router.
DeepSeek birincil, Gemini fallback, Mock son çare.
"""

import os
from typing import Any, Optional

from services.deepseek import deepseek_grader
from services.gemini import gemini_grader
from services.mock_ai import grade_paper as mock_grade


class ModelRouter:
    """AI Model seçici — en iyi mevcut modele yönlendirir.

    Öncelik sırası:
    1. DeepSeek V4 (birincil)
    2. Gemini (fallback) — Phase 3: isteğe bağlı
    3. Mock AI (son çare)
    """

    PROVIDER_ORDER = ["deepseek", "gemini", "mock"]

    def __init__(self):
        self._providers: dict[str, dict[str, Any]] = {
            "deepseek": {
                "available": deepseek_grader.is_available,
                "grader": deepseek_grader,
                "name": "DeepSeek V4",
            },
            "gemini": {
                "available": gemini_grader.is_available,
                "grader": gemini_grader,
                "name": "Google Gemini Vision",
            },
            "mock": {
                "available": True,
                "grader": None,
                "name": "Mock AI",
            },
        }

    async def grade(
        self,
        question: str,
        answer: str,
        max_score: int,
        rubric: Optional[dict] = None,
        subject: str = "",
        preferred_provider: Optional[str] = None,
    ) -> dict[str, Any]:
        """En iyi mevcut AI ile puanla.

        Args:
            preferred_provider: Belirli bir provider zorla (test/debug için)
        """

        # Zorlanmış provider
        if preferred_provider and preferred_provider in self._providers:
            return await self._try_provider(
                preferred_provider, question, answer, max_score, rubric, subject
            )

        # Sırayla dene
        last_error = None
        for provider_name in self.PROVIDER_ORDER:
            provider = self._providers[provider_name]
            if provider["available"]:
                result = await self._try_provider(
                    provider_name, question, answer, max_score, rubric, subject
                )
                if result.get("provider") != "error":
                    return result
                last_error = result.get("fallback_reason", "unknown")

        # Hiçbiri çalışmadı → Mock son çare
        result = await mock_grade(question, answer, max_score)
        result["provider"] = "mock_emergency"
        result["fallback_reason"] = f"Tüm provider'lar başarısız: {last_error}"
        return result

    async def _try_provider(
        self,
        name: str,
        question: str,
        answer: str,
        max_score: int,
        rubric: Optional[dict],
        subject: str,
    ) -> dict[str, Any]:
        provider = self._providers[name]

        if name == "deepseek" and provider["grader"]:
            return await provider["grader"].grade(
                question, answer, max_score, rubric, subject
            )
        elif name == "gemini" and provider["grader"]:
            return await provider["grader"].grade(
                question, answer, max_score, rubric, subject
            )
        elif name == "mock":
            return await mock_grade(question, answer, max_score)
        else:
            return {
                "score": 0, "max_score": max_score,
                "confidence": 0, "confidence_band": "low",
                "review_required": True, "provider": "error",
                "fallback_reason": f"Provider '{name}' uygulanmadı",
            }

    def status(self) -> dict[str, Any]:
        """Tüm provider'ların durumunu raporla."""
        return {
            provider: info["available"]
            for provider, info in self._providers.items()
        }


# Singleton
model_router = ModelRouter()

# Router for FastAPI include
from fastapi import APIRouter as _APIRouter
router = _APIRouter()

@router.get("/health")
async def routing_health():
    """Model seçici sağlık durumu."""
    return {
        "providers": model_router.status(),
        "order": ModelRouter.PROVIDER_ORDER,
    }
