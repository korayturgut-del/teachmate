"""Dijital Öğretmen Asistanı — Gemini Vision Grading Service.

PATCH v1.16 (Adım 4): Decision Engine "matematik/grafik → Gemini Vision"
rotasını GERÇEKTEN bağlar. Önceden routing.py'de grader=None idi; artık
gerçek grader. API anahtarı yoksa graceful fallback (mock) — DeepSeek deseni.

Gemini, görsel muhakeme gerektiren sorular (matematik işlemi, grafik, şekil)
için tercih edilir. Metin tabanlı çağrı OpenAI-uyumlu endpoint üzerinden;
gerçek görüntü (vision) çağrısı image_base64 verildiğinde yapılır.
"""
import os
import json
from typing import Any, Optional


class GeminiGrader:
    """Google Gemini ile puanlama — vision yetenekli (matematik/grafik)."""

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY", "")
        self._available = bool(api_key and api_key != "***")
        self._client = None
        self._model = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
        if self._available:
            try:
                # Gemini, OpenAI-uyumlu endpoint sunar → mevcut openai client kullanılır
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(
                    api_key=api_key,
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                )
            except Exception:
                self._available = False

    @property
    def is_available(self) -> bool:
        return self._available and self._client is not None

    async def grade(
        self,
        question: str,
        answer: str,
        max_score: int,
        rubric: Optional[dict] = None,
        subject: str = "",
        image_base64: Optional[str] = None,
    ) -> dict[str, Any]:
        """Gemini Vision ile puanla.

        image_base64 verilirse görsel muhakeme yapar (matematik işlemi,
        grafik, şekil). Yoksa metin tabanlı değerlendirme.
        """
        if not self.is_available:
            return await self._fallback_mock(question, answer, max_score)

        rubric_text = ""
        if rubric and rubric.get("criteria"):
            rubric_text = "\n".join(
                f"- {c['criterion']}: {c['points']} puan"
                for c in rubric["criteria"]
            )

        system_prompt = (
            f"Sen {subject or 'genel'} dersinde uzman bir öğretmensin. "
            "Öğrenci yanıtını, varsa görseldeki matematik işlemini/grafiği/şekli "
            "dikkatle inceleyerek değerlendir. SADECE JSON döndür: "
            '{"score": int, "explanation": str, "confidence": float}'
        )
        user_text = (
            f"Soru: {question}\nÖğrenci yanıtı: {answer}\n"
            f"Maksimum puan: {max_score}\n"
            + (f"Rubrik:\n{rubric_text}\n" if rubric_text else "")
        )

        # Vision: görüntü varsa multimodal mesaj
        if image_base64:
            content = [
                {"type": "text", "text": user_text},
                {"type": "image_url",
                 "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
            ]
        else:
            content = user_text

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content},
                ],
                temperature=0.1,
                max_tokens=1024,
            )
            result = self._parse(response.choices[0].message.content or "{}", max_score)
            result["provider"] = "gemini_vision" if image_base64 else "gemini"
            return result
        except Exception as e:
            result = await self._fallback_mock(question, answer, max_score)
            result["fallback_reason"] = str(e)[:200]
            return result

    def _parse(self, text: str, max_score: int) -> dict[str, Any]:
        """Gemini JSON yanıtını ayrıştır (markdown fence temizle)."""
        cleaned = text.replace("```json", "").replace("```", "").strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            data = {}
        score = int(data.get("score", 0))
        score = max(0, min(score, max_score))
        confidence = float(data.get("confidence", 0.75))
        if confidence >= 0.85:
            band = "high"
        elif confidence >= 0.70:
            band = "mid"
        else:
            band = "low"
        return {
            "score": score,
            "max_score": max_score,
            "explanation": data.get("explanation", "Gemini değerlendirmesi."),
            "confidence": confidence,
            "confidence_band": band,
            "review_required": confidence < 0.70,
        }

    async def _fallback_mock(
        self, question: str, answer: str, max_score: int
    ) -> dict[str, Any]:
        """Gemini API yoksa → mock_ai'ye graceful fallback (DeepSeek deseni)."""
        from services.mock_ai import grade_paper
        result = await grade_paper(question, answer, max_score)
        result["provider"] = "gemini_fallback_mock"
        return result


# Singleton (deepseek_grader deseni)
gemini_grader = GeminiGrader()
