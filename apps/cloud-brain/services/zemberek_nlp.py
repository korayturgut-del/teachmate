"""Dijital Öğretmen Asistanı — Zemberek Türkçe NLP Servisi

v1.15: Gemini araştırması bulgusu — Zemberek morfoloji analizi.
Araştırma: "OCR → Zemberek → kök bulma + yazım denetimi → %92 doğruluk"

Zemberek: Açık kaynaklı Türkçe NLP (Java, JPype köprüsü).
Bu servis OCR çıktısını alır, Türkçe yazım hatalarını düzeltir.

Kurulum: pip install jpype1 && java -jar zemberek-full.jar
Zemberek JAR: https://github.com/ahmetaa/zemberek-nlp/releases

Fallback: Zemberek kurulu değilse basit regex-tabanlı Türkçe düzeltme.
"""

import re
import asyncio
from typing import Optional


# ── Türkçe karakter normalleştirme (Madde 5 uyumu) ─────────────────

_TR_FIXES = {
    # OCR sık karıştırdıkları
    "1": {"ı": ["l", "I"]},   # küçük i'siz
    "0": {"o": ["O"]},
}

# Yaygın OCR → Türkçe düzeltmeler (öğrenci yazısı için)
_COMMON_CORRECTIONS: dict[str, str] = {
    "ucgen": "üçgen",
    "dikdortgen": "dikdörtgen",
    "esit": "eşit",
    "acı": "açı",
    "formul": "formül",
    "hesapla": "hesapla",  # doğru
    "toplam": "toplam",
    "fark": "fark",
    "carpim": "çarpım",
    "bolum": "bölüm",
    "kare": "kare",
    "cevre": "çevre",
    "alan": "alan",
    "hipotenus": "hipotenüs",
    "pitagor": "Pisagor",
}

_TR_PATTERN = re.compile(r'\b(' + '|'.join(re.escape(k) for k in _COMMON_CORRECTIONS) + r')\b',
                         re.IGNORECASE)


def _regex_fallback(text: str) -> tuple[str, list[str]]:
    """Zemberek olmadan basit regex düzeltme."""
    corrections = []
    def replace(m: re.Match) -> str:
        wrong = m.group(0)
        correct = _COMMON_CORRECTIONS[wrong.lower()]
        if wrong != correct:
            corrections.append(f"{wrong} → {correct}")
        return correct
    corrected = _TR_PATTERN.sub(replace, text)
    return corrected, corrections


class ZemberekNLP:
    """Türkçe morfoloji analizi ve yazım denetimi.

    Önce gerçek Zemberek (JPype) dener, yoksa regex fallback.
    Gemini araştırması: "Zemberek + Cosine/LSK → %92 kısa cevap doğruluğu"
    """

    def __init__(self):
        self._zemberek = None
        self._available = False
        self._try_init()

    def _try_init(self):
        """Zemberek JAR'ı yüklemeyi dene."""
        try:
            import jpype
            import jpype.imports
            jar_path = "/opt/zemberek/zemberek-full.jar"
            import os
            if not os.path.exists(jar_path):
                return
            if not jpype.isJVMStarted():
                jpype.startJVM(classpath=[jar_path])
            from zemberek.morphology import TurkishMorphology  # type: ignore
            self._zemberek = TurkishMorphology.createWithDefaults()
            self._available = True
        except Exception:
            self._available = False

    @property
    def is_available(self) -> bool:
        return self._available

    async def correct_ocr_text(self, text: str) -> dict:
        """OCR metnini Türkçe morfoloji ile düzelt.

        Girdi: ham OCR metni (öğrenci el yazısından)
        Çıktı: { corrected_text, corrections, confidence, method }
        """
        if not text.strip():
            return {"corrected_text": text, "corrections": [], "confidence": 1.0, "method": "passthrough"}

        if self._available and self._zemberek:
            return await asyncio.to_thread(self._zemberek_correct, text)
        else:
            corrected, corrections = _regex_fallback(text)
            return {
                "corrected_text": corrected,
                "corrections": corrections,
                "confidence": 0.75,  # regex fallback daha az güvenilir
                "method": "regex_fallback",
            }

    def _zemberek_correct(self, text: str) -> dict:
        """Gerçek Zemberek analizi (blocking — thread'de çalışır)."""
        words = text.split()
        corrected_words = []
        corrections = []

        for word in words:
            analysis = self._zemberek.analyzeAndDisambiguate(word)
            if analysis and analysis.bestAnalysis():
                best = analysis.bestAnalysis()[0]
                normalized = str(best.getLemmas()[0]) if best.getLemmas() else word
                if normalized.lower() != word.lower():
                    corrections.append(f"{word} → {normalized}")
                corrected_words.append(normalized)
            else:
                corrected_words.append(word)

        return {
            "corrected_text": " ".join(corrected_words),
            "corrections": corrections,
            "confidence": 0.92,  # Araştırma: Zemberek + NLP %92 doğruluk
            "method": "zemberek",
        }

    async def extract_math_keywords(self, text: str) -> list[str]:
        """Matematiksel anahtar kelimeleri çıkar (rubrik eşleştirmesi için)."""
        math_terms = {
            "toplam", "fark", "çarpım", "bölüm", "kare", "küp",
            "karekök", "mutlak", "eşit", "büyük", "küçük",
            "açı", "derece", "üçgen", "dörtgen", "çevre", "alan",
            "formül", "denklem", "değişken", "sabit", "katsayı",
        }
        words_lower = text.lower().split()
        return [w for w in words_lower if w in math_terms]


# Singleton
zemberek_nlp = ZemberekNLP()
