"""Dijital Öğretmen Asistanı — DeepSeek AI Service

Phase 3: Gerçek DeepSeek V4 entegrasyonu (OpenAI uyumlu SDK).
Mock AI'dan gerçek AI'a geçiş — ADR-006 tamamlandı.

Kullanım:
    from services.deepseek import DeepSeekGrader
    grader = DeepSeekGrader()
    result = await grader.grade(question, answer, max_score, rubric)
"""

import os
import asyncio
from typing import Any, Optional

from openai import AsyncOpenAI


class DeepSeekGrader:
    """DeepSeek V4 API ile sınav puanlama.

    OpenAI uyumlu SDK kullanır. API key .env'den okunur.
    Fallback: API key yoksa veya hata alınırsa Mock AI'a döner.
    """

    def __init__(self):
        api_key = os.getenv("DEEPSEEK_API_KEY", "")
        self._available = bool(api_key and api_key != "***")
        self._client = None

        if self._available:
            self._client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://api.deepseek.com",
                timeout=30.0,
                max_retries=2,
            )

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
    ) -> dict[str, Any]:
        """DeepSeek ile öğrenci yanıtını değerlendir.

        Args:
            question: Soru metni
            answer: Öğrenci yanıtı
            max_score: Sorunun maksimum puanı
            rubric: Değerlendirme kriterleri (rubrik)
            subject: Ders adı (bağlam için)

        Returns:
            {
                score, max_score, explanation, confidence,
                confidence_band, review_required, provider
            }
        """
        if not self.is_available:
            return await self._fallback_mock(question, answer, max_score)

        rubric_text = ""
        if rubric and rubric.get("criteria"):
            criteria = rubric["criteria"]
            rubric_text = "\n".join(
                f"- {c['criterion']}: {c['points']} puan" for c in criteria
            )

        system_prompt = self._build_system_prompt(subject)
        user_prompt = self._build_user_prompt(
            question, answer, max_score, rubric_text
        )

        try:
            response = await self._client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,  # Düşük sıcaklık = tutarlı puanlama
                max_tokens=1024,
                response_format={"type": "json_object"},
            )

            result = self._parse_response(
                response.choices[0].message.content or "{}"
            )
            result["provider"] = "deepseek"
            return result

        except Exception as e:
            # Herhangi bir hata → Mock AI'a graceful fallback
            result = await self._fallback_mock(question, answer, max_score)
            result["fallback_reason"] = str(e)[:200]
            return result

    def _build_system_prompt(self, subject: str) -> str:
        subject_context = f"Bu bir {subject} sınavıdır. " if subject else ""
        return f"""Sen bir {subject_context}eğitim değerlendirme uzmanısın.
Öğrenci yanıtlarını adil, tutarlı ve MEB kriterlerine uygun değerlendir.

Yanıtını her zaman JSON formatında ver:
{{
  "score": <tam sayı puan>,
  "max_score": <maksimum>,
  "explanation": "<kısa açıklama>",
  "confidence": <0.0-1.0 arası güven skoru>,
  "partial_credits": [{{"reason": "...", "points": <sayı>}}]
}}

Kurallar:
- Tamamen doğru yanıta tam puan ver
- Kısmen doğru yanıtlara orantılı puan ver
- Boş veya tamamen alakasız yanıta 0 puan ver
- İşlem hatası varsa yöntem puanı ver (Türk eğitim sistemi)
- Öğrencinin çözüm yolu farklı ama doğruysa tam puan ver
"""

    def _build_user_prompt(
        self,
        question: str,
        answer: str,
        max_score: int,
        rubric_text: str,
    ) -> str:
        rubric_section = (
            f"\nDeğerlendirme Kriterleri (Rubrik):\n{rubric_text}"
            if rubric_text else ""
        )
        prompt = f"""Soru:
{question}

Öğrencinin Yanıtı:
{answer if answer else "(boş)"}

Maksimum Puan: {max_score}{rubric_section}

Bu yanıtı değerlendir ve JSON formatında puan ver."""
        return prompt

    def _parse_response(self, content: str) -> dict[str, Any]:
        import json

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # Kırık JSON durumunda boundary extraction
            import re
            match = re.search(r'\{[^{}]*"score"[^{}]*\}', content)
            if match:
                data = json.loads(match.group())
            else:
                return self._error_result()

        score = int(data.get("score", 0))
        confidence = float(data.get("confidence", 0.85))
        max_score = int(data.get("max_score", 100))

        # Kural 12: Güven eşiği değerlendirmesi
        review_required = confidence < 0.70
        if confidence >= 0.85:
            confidence_band = "high"
        elif confidence >= 0.70:
            confidence_band = "mid"
        else:
            confidence_band = "low"

        return {
            "score": min(score, max_score),
            "max_score": max_score,
            "explanation": data.get("explanation", ""),
            "confidence": confidence,
            "confidence_band": confidence_band,
            "review_required": review_required,
            "partial_credits": data.get("partial_credits", []),
        }

    async def _fallback_mock(
        self, question: str, answer: str, max_score: int
    ) -> dict[str, Any]:
        """API kullanılamadığında Mock AI fallback."""
        from services.mock_ai import grade_paper
        return await grade_paper(question, answer, max_score)

    def _error_result(self) -> dict[str, Any]:
        return {
            "score": 0,
            "max_score": 100,
            "explanation": "Değerlendirme yapılamadı — lütfen manuel puanlayın.",
            "confidence": 0.0,
            "confidence_band": "low",
            "review_required": True,
            "provider": "error",
        }


    async def batch_grade(
        self,
        papers: list[dict[str, Any]],
        concurrency: int = 3,
    ) -> list[dict[str, Any]]:
        """Toplu puanlama — paralel istekler.

        Args:
            papers: [{"question": "...", "answer": "...", "max_score": 10}, ...]
            concurrency: Eşzamanlı istek sayısı
        """
        semaphore = asyncio.Semaphore(concurrency)

        async def _grade_one(paper: dict) -> dict:
            async with semaphore:
                return await self.grade(
                    paper["question"],
                    paper.get("answer", ""),
                    paper.get("max_score", 10),
                    paper.get("rubric"),
                    paper.get("subject", ""),
                )

        tasks = [_grade_one(p) for p in papers]
        return await asyncio.gather(*tasks)


# Singleton
deepseek_grader = DeepSeekGrader()
