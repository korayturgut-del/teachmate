"""Dijital Öğretmen Asistanı — Yazılı Okuma AI · Okuyucu

ai/yazili_okuma/reader.py

Sınav kağıdı okuma AI'ının ana mantığı.
Madde 6 zinciri: cevap anahtarı → AI → öğretmen.

İZOLASYON:
  - Sağlayıcıya ai/ortak/provider.py üzerinden erişir
  - ai/performans/* dosyalarını ASLA import etmez
  - Bu dosyayı değiştirmek performans AI'ını ETKİLEMEZ
"""

from typing import Any, Optional

from ai.ortak.provider import ai_provider
from ai.yazili_okuma.prompts import (
    build_grading_system_prompt, build_grading_user_prompt,
    confidence_band, needs_review,
)
from ai.yazili_okuma.grading import answer_key_response, score_to_response


class YaziliOkumaReader:
    """Sınav kağıdı okuma ve puanlama.

    Sağlayıcı ai/ortak/provider.py'de yönetilir.
    Bu sınıf yalnızca yazılı-okuma mantığını içerir.
    """

    @property
    def active_provider(self) -> str:
        return ai_provider.active

    # ── Tek soru puanlama ───────────────────────────────────

    async def grade_question(
        self,
        question: str,
        answer: str = "",
        max_score: int = 10,
        subject: str = "",
        rubric: Optional[dict] = None,
        correct_answer: Optional[str] = None,
        alternatives: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Tek soruyu puanlar.

        Madde 6 zinciri:
          1. Cevap anahtarı varsa eşleştir (AI'sız, kesin)
          2. Eşleşmezse AI puanlama
          3. AI yoksa düşük güvenli iskelet → öğretmen
        """
        # ADIM 1: Cevap anahtarı (deterministik)
        if correct_answer is not None:
            ak = answer_key_response(
                question, answer, max_score, correct_answer, alternatives,
            )
            if ak is not None:
                return ak  # kesin eşleşme veya boş yanıt

        # ADIM 2: AI puanlama (ortak provider üzerinden)
        system_prompt = build_grading_system_prompt(subject)
        user_prompt = build_grading_user_prompt(
            question, answer, max_score, rubric,
        )
        raw = await ai_provider.grade(
            question=system_prompt,
            answer=user_prompt,
            max_score=max_score,
            needs_vision=False,
        )
        if raw is not None:
            raw["provider"] = ai_provider.active
            return score_to_response(raw, max_score)

        # ADIM 3: AI yok → öğretmen incelemesi gerekli
        return {
            "score": 0,
            "max_score": max_score,
            "explanation": "AI sağlayıcı pasif — bu soru manuel puanlanmalı.",
            "confidence": 0.0,
            "confidence_band": "low",
            "review_required": True,
            "provider": "manual",
            "partial_credits": [],
        }

    # ── Toplu puanlama ──────────────────────────────────────

    async def grade_batch(
        self, papers: list[dict],
    ) -> list[dict[str, Any]]:
        """Birden çok soruyu sırayla puanlar."""
        results = []
        for p in papers:
            r = await self.grade_question(
                question=p.get("question", ""),
                answer=p.get("answer", ""),
                max_score=p.get("max_score", 10),
                subject=p.get("subject", ""),
                rubric=p.get("rubric"),
                correct_answer=p.get("correct_answer"),
                alternatives=p.get("alternatives"),
            )
            results.append(r)
        return results

    # ── Sınav kağıdı okuma (görsel) ─────────────────────────

    async def read_exam_sheet(
        self,
        questions: list[dict],
        image_base64: str,
        student_name: str = "Öğrenci",
    ) -> dict[str, Any]:
        """Tüm sınav kağıdını okur ve puanlar.

        Tercih sırası:
          1. DeepSeek-OCR 2 (tek seferde tüm kağıt — en ucuz)
          2. Gemini Vision (soru-soru)
          3. Manuel iskelet
        """
        max_total = sum(int(q.get("puan", 10)) for q in questions)

        # Öncelik: DeepSeek-OCR 2 — tek seferde tüm sayfayı işler
        if ai_provider.deepseek_ocr_available and image_base64:
            try:
                from services.deepseek_ocr import deepseek_ocr_grader
                return await deepseek_ocr_grader.read_exam_sheet(
                    image_base64=image_base64,
                    questions=questions,
                    student_name=student_name,
                )
            except Exception:
                pass  # Gemini fallback'e düş

        if not ai_provider.has_vision or not image_base64:
            return self._manual_skeleton(questions, student_name, max_total)

        findings = []
        total = 0
        for q in questions:
            q_max = int(q.get("puan", 10))
            graded = await self.grade_question(
                question=q.get("soru", ""),
                answer=q.get("cevap", ""),
                max_score=q_max,
                correct_answer=q.get("cevap"),
            )
            total += graded["score"]
            findings.append({
                "questionId": q.get("num", len(findings) + 1),
                "ocrText": graded.get("ocr_text", ""),
                "score": graded["score"],
                "critique": graded["explanation"],
            })

        percent = round((total / max_total) * 100) if max_total else 0
        return {
            "findings": findings,
            "studentName": student_name,
            "total_score": total,
            "max_score": max_total,
            "percent": percent,
            "overall_feedback": (
                f"{student_name} sınavda {total}/{max_total} puan aldı."
            ),
            "provider": ai_provider.active,
        }

    def _manual_skeleton(self, questions, student_name, max_total) -> dict:
        """AI yokken manuel puanlama iskeleti."""
        return {
            "findings": [
                {
                    "questionId": q.get("num", i + 1),
                    "ocrText": "",
                    "score": 0,
                    "critique": "AI sağlayıcı pasif — manuel puanlayın.",
                }
                for i, q in enumerate(questions)
            ],
            "studentName": student_name,
            "total_score": 0,
            "max_score": max_total,
            "percent": 0,
            "overall_feedback": (
                "AI sağlayıcı yapılandırılmadığı için sınav iskeleti "
                "hazırlandı. Puanları manuel girebilirsiniz."
            ),
            "provider": "manual",
        }


# Yazılı okuma AI singleton
yazili_okuma_reader = YaziliOkumaReader()
