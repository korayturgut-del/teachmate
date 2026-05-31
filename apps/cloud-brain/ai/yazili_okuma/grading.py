"""Dijital Öğretmen Asistanı — Yazılı Okuma AI · Puanlama

ai/yazili_okuma/grading.py

Sınav puanlama mantığı. Cevap anahtarı eşleştirme + AI puanlama.

Bu dosya YALNIZCA yazılı-okuma AI'ına aittir.
"""

from ai.yazili_okuma.prompts import confidence_band, needs_review


def _normalize_tr(s: str) -> str:
    """Türkçe metin normalleştirme — karşılaştırma için."""
    if not s:
        return ""
    tr_map = str.maketrans("ÇĞİÖŞÜçğıöşü", "cgiosucgiosu")
    return s.strip().lower().translate(tr_map)


class AnswerKeyMatcher:
    """Cevap anahtarı eşleştirme — deterministik, AI'sız.

    Madde 6: önce cevap anahtarı, AI son çare. Kapalı uçlu
    sorularda AI'a hiç gerek kalmadan kesin puan verilir.
    """

    @staticmethod
    def match(student_answer: str, correct_answer: str,
              alternatives: list[str] = None) -> dict:
        """Öğrenci yanıtını cevap anahtarıyla karşılaştırır.

        Döner: {matched: bool, confidence: float}
        """
        sa = _normalize_tr(student_answer)
        ca = _normalize_tr(correct_answer)

        if not sa:
            return {"matched": False, "confidence": 1.0, "reason": "boş yanıt"}

        # Tam eşleşme
        if sa == ca:
            return {"matched": True, "confidence": 1.0, "reason": "tam eşleşme"}

        # Alternatif cevaplar (örn "4" = "dört" = "IV")
        for alt in (alternatives or []):
            if sa == _normalize_tr(alt):
                return {"matched": True, "confidence": 1.0,
                        "reason": "alternatif eşleşme"}

        # İçerme (kısmi)
        if ca and (ca in sa or sa in ca):
            return {"matched": False, "confidence": 0.6,
                    "reason": "kısmi içerme — AI gerekli"}

        return {"matched": False, "confidence": 0.5,
                "reason": "eşleşme yok — AI gerekli"}


def score_to_response(raw: dict, max_score: int) -> dict:
    """AI ham çıktısını standart puanlama yanıtına çevirir.

    Kural 12 (güven eşiği) burada uygulanır.
    """
    score = int(raw.get("score", 0))
    score = max(0, min(score, max_score))
    confidence = float(raw.get("confidence", 0.5))

    return {
        "score": score,
        "max_score": max_score,
        "explanation": raw.get("explanation", ""),
        "confidence": confidence,
        "confidence_band": confidence_band(confidence),
        "review_required": needs_review(confidence),
        "provider": raw.get("provider", "unknown"),
        "partial_credits": raw.get("partial_credits", []),
    }


def answer_key_response(question: str, answer: str, max_score: int,
                        correct: str, alternatives: list[str] = None) -> dict:
    """Cevap anahtarı eşleşmesinden doğrudan puanlama yanıtı üretir.

    AI çağrılmadan — Madde 6 zinciri: en hızlı, en ucuz yol.
    Eşleşme yoksa None döner (çağıran taraf AI'a yönlendirir).
    """
    match = AnswerKeyMatcher.match(answer, correct, alternatives)
    if match["matched"]:
        return {
            "score": max_score,
            "max_score": max_score,
            "explanation": f"Cevap anahtarı: {match['reason']}.",
            "confidence": 1.0,
            "confidence_band": "high",
            "review_required": False,
            "provider": "answer_key",
            "partial_credits": [],
        }
    if not _normalize_tr(answer):
        # Boş yanıt — kesin 0
        return {
            "score": 0,
            "max_score": max_score,
            "explanation": "Yanıt boş bırakılmış.",
            "confidence": 1.0,
            "confidence_band": "high",
            "review_required": False,
            "provider": "answer_key",
            "partial_credits": [],
        }
    return None  # eşleşme yok → AI gerekli
