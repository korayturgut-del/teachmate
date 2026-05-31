"""Dijital Öğretmen Asistanı — DeepSeek-OCR 2 Servisi

services/deepseek_ocr.py

DeepSeek-OCR 2: DeepSeek'in görsel + OCR'ya özelleşmiş modeli.
Sınav kağıdı fotoğraflarından el yazısı/basılı metni okur,
yapılandırılmış JSON çıktısı üretir.

Maliyet: düşük (görsel OCR için tercih edilen ucuz motor).
API: OpenAI uyumlu — base_url farkı.

Fallback zinciri (yazılı-okuma AI'ında):
  1. DeepSeek-OCR 2  → görsel OCR (bu dosya)
  2. Gemini Vision   → görsel fallback
  3. PaddleOCR yerel → tam offline fallback
  4. Manuel iskelet  → öğretmen
"""

import os
import base64
import json
import re
from typing import Any, Optional

try:
    from openai import AsyncOpenAI
    _HAS_OPENAI_SDK = True
except ImportError:
    _HAS_OPENAI_SDK = False


class DeepSeekOCRGrader:
    """DeepSeek-OCR 2 ile sınav kağıdı okuma ve puanlama.

    Hem OCR (görsel→metin) hem değerlendirme (metin→puan) yapar.
    Yazılı-okuma AI'ı tarafından kullanılır.
    """

    # DeepSeek-OCR 2 model adı (2026 itibariyle)
    DEFAULT_MODEL = "deepseek-ocr-2"

    def __init__(self):
        api_key = os.getenv("DEEPSEEK_OCR_API_KEY") or os.getenv("DEEPSEEK_API_KEY", "")
        self._available = bool(api_key and api_key != "***") and _HAS_OPENAI_SDK
        self._client = None
        self._model = os.getenv("DEEPSEEK_OCR_MODEL", self.DEFAULT_MODEL)

        if self._available:
            self._client = AsyncOpenAI(
                api_key=api_key,
                base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
                timeout=60.0,
                max_retries=2,
            )

    @property
    def is_available(self) -> bool:
        return self._available and self._client is not None

    # ── Tek soru OCR + puanlama ─────────────────────────────

    async def grade_with_image(
        self,
        question: str,
        answer: str = "",
        max_score: int = 10,
        image_base64: Optional[str] = None,
        subject: str = "",
        rubric: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Görsel + soru → OCR + puanlama.

        image_base64 verildiyse OCR'la birlikte puanlar; verilmediyse
        sadece metin değerlendirme yapar (DeepSeek V4 davranışı).
        """
        if not self.is_available:
            return self._fallback_response(max_score)

        messages = [
            {
                "role": "system",
                "content": self._build_system_prompt(subject),
            },
            {
                "role": "user",
                "content": self._build_user_content(
                    question, answer, max_score, image_base64, rubric,
                ),
            },
        ]

        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=0.2,
                response_format={"type": "json_object"},
                max_tokens=1500,
            )
            content = resp.choices[0].message.content
            return self._parse_response(content, max_score)
        except Exception as e:
            return {
                "score": 0,
                "max_score": max_score,
                "explanation": f"DeepSeek-OCR hatası: {e}",
                "confidence": 0.0,
                "ocr_text": "",
                "provider": "deepseek_ocr_error",
                "review_required": True,
            }

    # Eski API uyumluluğu — yalnızca metin
    async def grade(
        self, question: str, answer: str, max_score: int,
        rubric: Optional[dict] = None, subject: str = "",
    ) -> dict[str, Any]:
        return await self.grade_with_image(
            question=question, answer=answer, max_score=max_score,
            image_base64=None, subject=subject, rubric=rubric,
        )

    # ── Tam sınav kağıdı OCR ────────────────────────────────

    async def read_exam_sheet(
        self,
        image_base64: str,
        questions: list[dict],
        student_name: str = "Öğrenci",
    ) -> dict[str, Any]:
        """Tüm sınav kağıdını tek seferde okur ve soru-soru puanlar."""
        if not self.is_available:
            return self._sheet_fallback(questions, student_name)

        prompt = self._build_sheet_prompt(questions)
        messages = [
            {
                "role": "system",
                "content": "Sen sınav kağıdı okuyan ve adil puanlayan deneyimli bir öğretmensin. "
                           "El yazısı dahil Türkçe metni hassas oku. Cevabı JSON olarak ver.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": _ensure_data_url(image_base64)},
                    },
                ],
            },
        ]

        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=0.2,
                response_format={"type": "json_object"},
                max_tokens=3000,
            )
            data = json.loads(resp.choices[0].message.content)
            return self._normalize_sheet(data, questions, student_name)
        except Exception as e:
            fallback = self._sheet_fallback(questions, student_name)
            fallback["error"] = str(e)
            return fallback

    # ── Yardımcılar ─────────────────────────────────────────

    def _build_system_prompt(self, subject: str) -> str:
        ders = f" ({subject} dersi)" if subject else ""
        return (
            f"Sen deneyimli bir öğretmensin{ders}. Öğrencinin sınav "
            "yanıtını adil, tutarlı ve yapıcı biçimde puanlarsın. "
            "Görsel verildiyse el yazısını dikkatle oku. Kısmi doğruya "
            "kısmi puan verirsin.\n\n"
            "Yanıtını şu JSON şemasında ver:\n"
            "{\n"
            '  "score": <0-max_score arası tam sayı>,\n'
            '  "ocr_text": "<görselden okunan metin (varsa)>",\n'
            '  "explanation": "<puanlama gerekçesi>",\n'
            '  "confidence": <0.0-1.0>,\n'
            '  "partial_credits": [<varsa kısmi puan kalemleri>]\n'
            "}"
        )

    def _build_user_content(
        self, question, answer, max_score, image_base64, rubric,
    ):
        text_parts = [
            f"Soru: {question}",
            f"Maksimum puan: {max_score}",
        ]
        if answer:
            text_parts.append(f"Öğrenci yanıtı (metin): {answer}")
        if rubric:
            text_parts.append(f"Rubrik: {json.dumps(rubric, ensure_ascii=False)}")
        if image_base64:
            text_parts.append(
                "Yukarıdaki görsel öğrencinin yazılı yanıtıdır. "
                "Önce OCR yap, sonra puanla."
            )
        text_parts.append("İSTENEN JSON şemasında yanıt ver.")
        text_block = "\n".join(text_parts)

        if image_base64:
            return [
                {"type": "text", "text": text_block},
                {
                    "type": "image_url",
                    "image_url": {"url": _ensure_data_url(image_base64)},
                },
            ]
        return text_block

    def _build_sheet_prompt(self, questions) -> str:
        lines = [
            "Bu görsel bir öğrenci sınav kağıdı. Tüm soruları tek tek oku ve puanla.",
            "",
            "Sorular:",
        ]
        for q in questions:
            lines.append(
                f"  {q.get('num', '?')}. {q.get('soru', '')} "
                f"(doğru: {q.get('cevap', '?')}, puan: {q.get('puan', 10)})"
            )
        lines.append("")
        lines.append("Yanıtını şu JSON şemasında ver:")
        lines.append("{")
        lines.append('  "studentName": "<kağıttaki ad>",')
        lines.append('  "findings": [')
        lines.append('    {"questionId": <no>, "ocrText": "<okunan>",')
        lines.append('     "score": <puan>, "critique": "<gerekçe>"}')
        lines.append("  ],")
        lines.append('  "overall_feedback": "<genel değerlendirme>"')
        lines.append("}")
        return "\n".join(lines)

    def _parse_response(self, content: str, max_score: int) -> dict[str, Any]:
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", content, re.DOTALL)
            data = json.loads(m.group()) if m else {}

        score = int(data.get("score", 0))
        score = max(0, min(score, max_score))
        confidence = float(data.get("confidence", 0.7))

        return {
            "score": score,
            "max_score": max_score,
            "explanation": data.get("explanation", ""),
            "ocr_text": data.get("ocr_text", ""),
            "confidence": confidence,
            "review_required": confidence < 0.70,
            "provider": "deepseek_ocr",
            "partial_credits": data.get("partial_credits", []),
        }

    def _normalize_sheet(self, data, questions, student_name) -> dict[str, Any]:
        findings = data.get("findings", [])
        total = sum(int(f.get("score", 0)) for f in findings)
        max_total = sum(int(q.get("puan", 10)) for q in questions)
        percent = round((total / max_total) * 100) if max_total else 0
        return {
            "findings": findings,
            "studentName": data.get("studentName") or student_name,
            "total_score": total,
            "max_score": max_total,
            "percent": percent,
            "overall_feedback": data.get(
                "overall_feedback",
                f"{student_name} sınavda {total}/{max_total} puan aldı.",
            ),
            "provider": "deepseek_ocr",
        }

    def _fallback_response(self, max_score: int) -> dict[str, Any]:
        return {
            "score": 0,
            "max_score": max_score,
            "explanation": "DeepSeek-OCR API anahtarı tanımlı değil — manuel puanlayın.",
            "confidence": 0.0,
            "ocr_text": "",
            "provider": "deepseek_ocr_unavailable",
            "review_required": True,
        }

    def _sheet_fallback(self, questions, student_name) -> dict[str, Any]:
        max_total = sum(int(q.get("puan", 10)) for q in questions)
        return {
            "findings": [
                {
                    "questionId": q.get("num", i + 1),
                    "ocrText": "",
                    "score": 0,
                    "critique": "DeepSeek-OCR pasif — manuel puanlayın.",
                }
                for i, q in enumerate(questions)
            ],
            "studentName": student_name,
            "total_score": 0,
            "max_score": max_total,
            "percent": 0,
            "overall_feedback": "DeepSeek-OCR API anahtarı yok — manuel puanlama gerekli.",
            "provider": "deepseek_ocr_unavailable",
        }


def _ensure_data_url(image_base64: str) -> str:
    """base64 ya da data: URL'i normalleştir."""
    if image_base64.startswith("data:"):
        return image_base64
    return f"data:image/jpeg;base64,{image_base64}"


# Singleton
deepseek_ocr_grader = DeepSeekOCRGrader()
