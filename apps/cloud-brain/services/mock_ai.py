"""Dijital Öğretmen Asistanı — Cloud Brain Mock AI Service

Phase 1-2: Tüm AI yanıtları simüle edilir. Gecikme: 800–2400ms.
Phase 3'te deepseek.py ile değiştirilir.
"""

import asyncio
import random
from typing import Any


def _normalize_tr(s: str) -> str:
    """TR-aware normalize: küçük harf, fazla boşluk/noktalama temizle."""
    import re
    s = s.replace("I", "ı").replace("İ", "i").lower()
    s = re.sub(r"[^\wçğıöşü0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _grade_with_answer_key(
    answer: str,
    max_score: int,
    correct_answer: str | None,
    alternatives: list | None,
    rubric: list | None,
) -> tuple[int, float, str]:
    """Cevap anahtarı + rubrik tabanlı puanlama — DOĞRULUĞUN KALBİ.

    Vizyon: Cevap Anahtarı → Rubrik → AI → Öğretmen.
    Bu fonksiyon AI'dan ÖNCE deterministik eşleştirme yapar; rastgele değil.

    Returns: (score, confidence, explanation)
    """
    norm_answer = _normalize_tr(answer)

    # ── 1. KAPALI UÇLU: cevap anahtarı + alternatifler ile birebir eşleştirme ──
    if correct_answer:
        candidates = [correct_answer] + (alternatives or [])
        norm_candidates = [_normalize_tr(c) for c in candidates if c]
        if norm_answer and norm_answer in norm_candidates:
            return max_score, 0.97, "Cevap anahtarıyla birebir eşleşti."
        # Kısmi: anahtarın kelimelerinin ne kadarı yanıtta var?
        if norm_candidates:
            key_words = set(norm_candidates[0].split())
            ans_words = set(norm_answer.split())
            if key_words:
                overlap = len(key_words & ans_words) / len(key_words)
                if overlap >= 0.5:
                    return round(max_score * overlap), 0.80, \
                        f"Cevap anahtarıyla kısmi eşleşme (%{round(overlap*100)})."
        return 0, 0.92, "Cevap anahtarıyla eşleşmedi."

    # ── 2. AÇIK UÇLU: rubrik kriterleri ile puanlama ──
    if rubric:
        earned = 0.0
        matched_criteria = []
        for crit in rubric:
            keyword = _normalize_tr(crit.get("keyword", "") or crit.get("criterion", ""))
            points = crit.get("points", 0)
            if keyword and keyword in norm_answer:
                earned += points
                matched_criteria.append(crit.get("criterion", keyword))
        earned = min(earned, max_score)
        conf = 0.85 if matched_criteria else 0.65
        expl = (f"Rubrik kriterleri karşılandı: {', '.join(matched_criteria)}."
                if matched_criteria else "Rubrik kriterleri yanıtta bulunamadı.")
        return round(earned), conf, expl

    # ── 3. Anahtar/rubrik YOK: uzunluk heuristiği (en zayıf, fallback) ──
    answer_len = len(answer) if answer else 0
    if answer_len < 5:
        ratio = 0.1
    elif answer_len < 20:
        ratio = 0.35
    elif answer_len < 100:
        ratio = 0.6
    else:
        ratio = 0.75
    return round(max_score * ratio), 0.60, \
        "Cevap anahtarı/rubrik yok — yalnızca uzunluk tahmini (öğretmen onayı önerilir)."


async def grade_paper(
    question: str,
    answer: str,
    max_score: int,
    rubric: dict | None = None,
    correct_answer: str | None = None,
    alternatives: list | None = None,
) -> dict[str, Any]:
    """Öğrenci yanıtını değerlendir.

    ÖNCELİK SIRASI (doğruluk için): Cevap Anahtarı → Rubrik → AI heuristik.
    Cevap anahtarı varsa deterministik eşleşir (rastgele DEĞİL).

    Args:
        question: Soru metni
        answer: Öğrenci yanıtı
        max_score: Sorunun maksimum puanı
        rubric: Rubrik kriter listesi [{criterion, keyword, points}]
        correct_answer: Cevap anahtarındaki doğru cevap
        alternatives: Kabul edilebilir alternatif cevaplar
    """
    # Gerçekçi gecikme
    await asyncio.sleep(random.uniform(0.3, 0.9))

    rubric_list = rubric.get("criteria") if isinstance(rubric, dict) else rubric
    score, confidence, key_explanation = _grade_with_answer_key(
        answer, max_score, correct_answer, alternatives, rubric_list
    )

    # Phase 2.5: AI Güven Eşiği (Kural 12)
    review_required = confidence < 0.70
    if confidence >= 0.85:
        confidence_band = "high"
    elif confidence >= 0.70:
        confidence_band = "mid"
    else:
        confidence_band = "low"

    return {
        "score": score,
        "max_score": max_score,
        "explanation": key_explanation,
        "confidence": confidence,
        "confidence_band": confidence_band,
        "review_required": review_required,
        "mock": True,
    }


async def ocr_image(image_base64: str, fast: bool = True) -> dict[str, Any]:
    """Görüntüden metin çıkar (Mock — Phase 1-2).

    Phase 3'te PaddleOCR ONNX ile değiştirilir.
    """
    await asyncio.sleep(random.uniform(0.5, 1.5))

    return {
        "text": "[MOCK] Bu bir simüle OCR çıktısıdır. Gerçek OCR Phase 3'te.",
        "confidence": round(random.uniform(0.7, 0.92), 2),
        "mock": True,
    }


async def extract_student_info(image_base64: str) -> dict[str, Any]:
    """Öğrenci bilgilerini ayıkla (Mock — Phase 1-2)."""
    await asyncio.sleep(random.uniform(0.5, 1.2))

    return {
        "student_name": "Ali Yılmaz",
        "student_no": "1234",
        "class_name": "9-A",
        "school": "Atatürk Anadolu Lisesi",
        "subject": "Matematik",
        "exam_type": "yazili_1",
        "mock": True,
    }


async def health_check() -> dict[str, Any]:
    """Mock AI servis sağlık kontrolü."""
    return {
        "status": "healthy",
        "provider": "mock",
        "mock": True,
        "message": "Phase 1-2 Mock AI aktif. DeepSeek Phase 3'te.",
    }
