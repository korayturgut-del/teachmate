"""Dijital Öğretmen Asistanı — Ortak AI Sağlayıcı Katmanı

ai/ortak/provider.py

Bu dosya iki AI modülünün PAYLAŞTIĞI tek bağlantı noktasıdır:
  - ai/performans/    (Maarif performans değerlendirme AI'ı)
  - ai/yazili_okuma/  (Sınav kağıdı okuma AI'ı)

İki AI modülü birbirini ASLA import etmez. Sadece bu dosyayı
kullanırlar. Böylece:
  - Performans AI'ı değişince yazılı-okuma AI'ı bozulmaz
  - Yazılı-okuma AI'ı değişince performans AI'ı bozulmaz
  - Sağlayıcı (Gemini/DeepSeek) değişikliği tek yerden yönetilir

Sağlayıcı zinciri: Gemini → DeepSeek → Mock
AI_PROVIDER ortam değişkeniyle yönlendirilir.
"""

import os
from typing import Any, Optional


class AIProvider:
    """AI sağlayıcılarını soyutlayan ortak katman.

    Hem metin (DeepSeek) hem görsel (Gemini Vision) destekler.
    Hiçbir sağlayıcı yoksa çağıran modül kendi kural-tabanlı
    (rubric) yöntemine düşer — bu sınıf Mock döndürmez, sadece
    'sağlayıcı yok' bilgisini net verir.
    """

    def __init__(self):
        self.mode = os.getenv("AI_PROVIDER", "auto")
        self._gemini = None
        self._deepseek = None
        self._deepseek_ocr = None
        self._rubric = None
        self._load()

    def _load(self):
        """Mevcut sağlayıcıları güvenli biçimde yükle."""
        # DeepSeek-OCR 2 (görsel/OCR için birincil, düşük maliyetli motor)
        try:
            from services.deepseek_ocr import deepseek_ocr_grader
            self._deepseek_ocr = deepseek_ocr_grader
        except Exception:
            self._deepseek_ocr = None
        try:
            from services.gemini import gemini_grader
            self._gemini = gemini_grader
        except Exception:
            self._gemini = None
        try:
            from services.deepseek import deepseek_grader
            self._deepseek = deepseek_grader
        except Exception:
            self._deepseek = None
        # Deterministik rubric motoru — AI sağlayıcı hiç yokken bile sistem
        # bir cevaba sahip olsun. Güvenli/gecikmeli import: ai.ortak'ın
        # ai.performans'a sert bağımlılığı OLMAZ, yalnızca varsa kullanır.
        try:
            from ai.performans.rubric import MaarifRubric
            self._rubric = MaarifRubric()
        except Exception:
            self._rubric = None

    # ── Durum sorgulama ─────────────────────────────────────

    @property
    def gemini_available(self) -> bool:
        return bool(self._gemini and getattr(self._gemini, "is_available", False))

    @property
    def deepseek_available(self) -> bool:
        return bool(self._deepseek and getattr(self._deepseek, "is_available", False))

    @property
    def rubric_available(self) -> bool:
        """Deterministik kural motoru yüklü mü? (her zaman son güvence)"""
        return self._rubric is not None

    @property
    def deepseek_ocr_available(self) -> bool:
        return bool(self._deepseek_ocr and getattr(self._deepseek_ocr, 'is_available', False))

    @property
    def has_vision(self) -> bool:
        """Görsel işleyebilen bir sağlayıcı var mı?
        DeepSeek-OCR 2 (öncelikli) veya Gemini Vision."""
        return self.deepseek_ocr_available or self.gemini_available

    @property
    def has_text(self) -> bool:
        """Metin işleyebilen bir sağlayıcı var mı?"""
        return self.gemini_available or self.deepseek_available

    @property
    def active(self) -> str:
        """Aktif sağlayıcının adı — UI rozetinde gösterilir.

        Zincir: mock → deepseek_ocr → gemini → deepseek → rubric → none.
        Görsel/OCR işlerde DeepSeek-OCR 2 birincildir (düşük maliyetli).
        AI yoksa 'rubric' (deterministik motor); o da yoksa 'none'.
        """
        if self.mode == "mock":
            return "mock"
        if self.deepseek_ocr_available:
            return "deepseek_ocr"
        if self.gemini_available:
            return "gemini"
        if self.deepseek_available:
            return "deepseek"
        if self.rubric_available:
            return "rubric"
        return "none"

    # ── Görev yönlendirme ───────────────────────────────────

    def pick_engine(self, needs_vision: bool = False):
        """Göreve uygun motoru döndürür.

        needs_vision=True  → görsel gerektiren görev (sınav fotoğrafı,
                             performans foto kanıtı)
        needs_vision=False → metin görevi

        Döndürülen motorun grade() metodu vardır. Motor yoksa None.
        """
        if self.mode == "mock":
            return None  # çağıran taraf rubric/mock'a düşsün

        if needs_vision:
            # Görsel öncelik zinciri: DeepSeek-OCR 2 → Gemini Vision
            if self.deepseek_ocr_available:
                return self._deepseek_ocr
            if self.gemini_available:
                return self._gemini
            return None

        # Metin: Gemini öncelikli, sonra DeepSeek
        if self.gemini_available:
            return self._gemini
        if self.deepseek_available:
            return self._deepseek
        return None

    async def grade(
        self,
        question: str,
        answer: str = "",
        max_score: int = 100,
        needs_vision: bool = False,
        image_base64: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Ortak puanlama çağrısı.

        Uygun motoru seçer ve çalıştırır. Motor yoksa None döner —
        çağıran modül bunu görüp kendi kural-tabanlı yöntemine geçer.
        """
        engine = self.pick_engine(needs_vision=needs_vision)
        if engine is None:
            return None

        try:
            # Gemini Vision görsel parametresi destekliyorsa ilet
            if image_base64 and hasattr(engine, "grade_with_image"):
                return await engine.grade_with_image(
                    question=question, answer=answer,
                    max_score=max_score, image_base64=image_base64,
                )
            return await engine.grade(
                question=question, answer=answer, max_score=max_score,
            )
        except Exception:
            # Sağlayıcı hatası → çağıran taraf rubric'e düşsün
            return None

    def status(self) -> dict[str, Any]:
        """Sağlayıcı durum raporu — health endpoint'leri için."""
        return {
            "mode": self.mode,
            "active": self.active,
            "deepseek_ocr_available": self.deepseek_ocr_available,
            "gemini_available": self.gemini_available,
            "deepseek_available": self.deepseek_available,
            "rubric_available": self.rubric_available,
            "has_vision": self.has_vision,
            "has_text": self.has_text,
        }


# Tek paylaşılan örnek — iki AI modülü de bunu import eder
ai_provider = AIProvider()
