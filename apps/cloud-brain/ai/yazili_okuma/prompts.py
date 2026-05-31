"""Dijital Öğretmen Asistanı — Yazılı Okuma AI · Promptlar

ai/yazili_okuma/prompts.py

Sınav kağıdı okuma ve puanlama promptları.

Bu dosya YALNIZCA yazılı-okuma AI'ına aittir. Performans AI'ı
(ai/performans/) bunu import etmez. Değiştirmek diğerini etkilemez.
"""


def build_grading_system_prompt(subject: str = "") -> str:
    """Sınav puanlama sistem promptu."""
    ders = f" ({subject} dersi)" if subject else ""
    return (
        f"Sen deneyimli bir öğretmensin{ders}. Öğrencinin sınav "
        "yanıtını adil, tutarlı ve yapıcı biçimde puanlarsın. "
        "Kısmi doğru yanıtlara kısmi puan verirsin. Puanlama "
        "gerekçeni kısa ve net açıklarsın.\n\n"
        "YANITINI ŞU JSON ŞEMASINDA VER:\n"
        "{\n"
        '  "score": <0-max_score arası tam sayı>,\n'
        '  "explanation": "<puanlama gerekçesi>",\n'
        '  "confidence": <0.0-1.0 güven skoru>,\n'
        '  "partial_credits": [<varsa kısmi puan kalemleri>]\n'
        "}"
    )


def build_grading_user_prompt(
    question: str, answer: str, max_score: int, rubric: dict = None,
) -> str:
    """Sınav puanlama kullanıcı promptu."""
    parts = [
        f"Soru: {question}",
        f"Maksimum puan: {max_score}",
        f"Öğrenci yanıtı: {answer or '(boş)'}",
    ]
    if rubric:
        parts.append(f"Rubrik: {rubric}")
    parts.append("Yukarıdaki yanıtı puanla ve İSTENEN JSON şemasında dön.")
    return "\n".join(parts)


def build_exam_ocr_prompt() -> str:
    """Sınav kağıdı OCR + analiz promptu (görsel)."""
    return (
        "Bu bir öğrenci sınav kağıdı fotoğrafı. Görevin:\n"
        "1. Kağıttaki öğrenci adını/numarasını oku\n"
        "2. Her sorunun yanıtını oku (el yazısı dahil)\n"
        "3. Doğru cevapla karşılaştırıp puanla\n\n"
        "YANITINI ŞU JSON ŞEMASINDA VER:\n"
        "{\n"
        '  "studentName": "<okunan ad>",\n'
        '  "findings": [\n'
        '    {"questionId": <no>, "ocrText": "<okunan yanıt>",\n'
        '     "score": <puan>, "critique": "<kısa gerekçe>"}\n'
        "  ],\n"
        '  "overall_feedback": "<genel değerlendirme>"\n'
        "}"
    )


# Güven eşikleri (Kural 12 — düşük güven → öğretmen incelemesi)
CONFIDENCE_THRESHOLDS = {
    "high": 0.85,   # ≥ 0.85 → otomatik kabul
    "mid": 0.70,    # 0.70-0.85 → kabul ama işaretli
    # < 0.70 → review_required = True
}


def confidence_band(confidence: float) -> str:
    """Güven skorunu banda çevirir."""
    if confidence >= CONFIDENCE_THRESHOLDS["high"]:
        return "high"
    if confidence >= CONFIDENCE_THRESHOLDS["mid"]:
        return "mid"
    return "low"


def needs_review(confidence: float) -> bool:
    """Kural 12: düşük güven → öğretmen incelemesi gerekli."""
    return confidence < CONFIDENCE_THRESHOLDS["mid"]
