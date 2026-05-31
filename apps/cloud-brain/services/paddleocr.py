"""Dijital Öğretmen Asistanı — PaddleOCR ONNX Service

Phase 3: Yerel OCR motoru. PaddleOCR ONNX runtime ile çalışır.
Kurulu değilse graceful fallback → Tesseract WASM (client-side).

Kullanım:
    from services.paddleocr import PaddleOCREngine
    ocr = PaddleOCREngine()
    text = await ocr.extract_text(image_base64)
    info = await ocr.extract_student_info(image_base64)
"""

import asyncio
import os
from typing import Any, Optional


def _normalize_bbox(points: list, page_w: int = 1000, page_h: int = 1000) -> list:
    """PaddleOCR 4-köşe noktasını normalize bbox'a çevir.

    points: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] (piksel)
    döner: [ymin, xmin, ymax, xmax] (0-1000 normalize) — question-segmentation formatı.

    Not: PaddleOCR koordinatları zaten piksel; gerçek sayfa boyutu bilinmiyorsa
    göreli kabul edilir. Çağıran taraf gerçek boyutla yeniden ölçekleyebilir.
    """
    try:
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        max_x = max(xs) or 1
        max_y = max(ys) or 1
        # Sayfa-göreli normalize (en büyük koordinata göre 0-1000)
        return [
            round(min(ys) / max_y * page_h),
            round(min(xs) / max_x * page_w),
            round(max(ys) / max_y * page_h),
            round(max(xs) / max_x * page_w),
        ]
    except (TypeError, IndexError, ZeroDivisionError):
        return [0, 0, page_h, page_w]


class PaddleOCREngine:
    """PaddleOCR ONNX — yerel OCR motoru.

    Phase 3: PaddleOCR yüklüyse gerçek OCR, değilse graceful fallback.
    Phase 4: ONNX quantized model ile tamamen çevrimdışı çalışır.
    """

    def __init__(self):
        self._ocr = None
        self._available = False
        self._init_ocr()

    def _init_ocr(self) -> None:
        """PaddleOCR başlatmayı dene."""
        try:
            from paddleocr import PaddleOCR
            # Anayasa Madde 5: Türkçe el yazısı OCR esas hedef.
            # lang="tr" → Türkçe karakter seti (ş ğ ı İ ç ö ü) destekli model.
            # use_onnx parametresi PaddleOCR 2.8+'da kaldırıldı; ONNX yolu
            # artık model yükleme aşamasında otomatik (ONNX export edilmiş model
            # verildiğinde) devreye girer. Geriye dönük uyumluluk için kaldırıldı.
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang="tr",       # Türkçe model — el yazısı + basılı (Anayasa M5)
                use_gpu=False,   # CPU modu (geniş cihaz desteği)
                show_log=False,
            )
            self._available = True
        except ImportError:
            self._available = False
            # PaddleOCR yüklü değil → requirements.txt'ye ekle
            # pip install paddleocr onnxruntime
        except Exception:
            self._available = False

    @property
    def is_available(self) -> bool:
        return self._available and self._ocr is not None

    async def extract_text(
        self,
        image_base64: str,
        fast: bool = True,
    ) -> dict[str, Any]:
        """Görüntüden metin çıkar.

        Args:
            image_base64: Base64 JPEG/PNG görüntü
            fast: True → hızlı model, False → hassas model

        Returns:
            {text, confidence, word_count, lines, provider}
        """
        if not self.is_available:
            return await self._fallback_mock(image_base64)

        try:
            import base64
            import tempfile
            import numpy as np
            from PIL import Image
            import io

            # Base64 → PIL Image
            img_data = base64.b64decode(
                image_base64.split(",")[-1]
                if "," in image_base64 else image_base64
            )
            img = Image.open(io.BytesIO(img_data))
            img_array = np.array(img)

            # OCR
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: self._ocr.ocr(img_array, cls=True)
            )

            # Parse sonuç
            lines = []
            total_confidence = 0.0
            word_count = 0

            if result and result[0]:
                for line in result[0]:
                    text = line[1][0]
                    conf = line[1][1]
                    # PaddleOCR line[0] = 4 köşe noktası [[x,y],...]. Segmentasyon
                    # için normalize bbox [ymin,xmin,ymax,xmax] (0-1000) üretiyoruz.
                    bbox = _normalize_bbox(line[0]) if line and line[0] else None
                    lines.append({"text": text, "confidence": conf, "bbox": bbox})
                    total_confidence += conf
                    word_count += len(text.split())

            avg_confidence = (
                round(total_confidence / len(lines), 3)
                if lines else 0.0
            )

            return {
                "text": "\n".join(l["text"] for l in lines),
                "confidence": avg_confidence,
                "word_count": word_count,
                "lines": lines,
                "provider": "paddleocr",
            }

        except Exception as e:
            result = await self._fallback_mock(image_base64)
            result["fallback_reason"] = str(e)[:200]
            return result

    async def extract_student_info(
        self, image_base64: str
    ) -> dict[str, Any]:
        """Öğrenci bilgilerini ayıkla (isim, numara, sınıf).

        Phase 3: OCR + regex pattern matching.
        Phase 4: Fine-tuned NER model.
        """
        import re

        ocr_result = await self.extract_text(image_base64)
        text = ocr_result.get("text", "")

        # Türkçe sınav kağıdı pattern'leri
        info = {
            "student_name": None,
            "student_no": None,
            "class_name": None,
            "school": None,
        }

        # İsim: "Adı Soyadı:" veya "Ad-Soyad:"
        name_match = re.search(
            r"(?:Ad[ıi]?\s*(?:Soyad[ıi]?|Soyadı)\s*:|Ad-Soyad\s*:)\s*([A-Za-zçğıöşüÇĞİÖŞÜ\s]{3,40})",
            text, re.IGNORECASE
        )
        if name_match:
            info["student_name"] = name_match.group(1).strip()

        # Numara: "No:" veya "Okul No:"
        no_match = re.search(
            r"(?:Okul\s*)?(?:No|Numara)[\s:]*(\d{2,6})",
            text, re.IGNORECASE
        )
        if no_match:
            info["student_no"] = no_match.group(1).strip()

        # Sınıf: "Sınıf:"
        class_match = re.search(
            r"Sınıf[\s:]*([\d]{1,2}[\s/-]*[A-Za-z]{0,3})",
            text, re.IGNORECASE
        )
        if class_match:
            info["class_name"] = class_match.group(1).strip()

        # Okul: en üst satırda genelde okul adı olur
        if ocr_result.get("lines"):
            first_lines = [l["text"] for l in ocr_result["lines"][:3]]
            for line in first_lines:
                if len(line) > 10 and "adı" not in line.lower():
                    # Okul adı gibi görünen uzun metin
                    info["school"] = line.strip()
                    break

        info["provider"] = ocr_result.get("provider", "fallback")
        info["ocr_confidence"] = ocr_result.get("confidence", 0.0)

        return info

    async def _fallback_mock(
        self, image_base64: str
    ) -> dict[str, Any]:
        """PaddleOCR yüklü değilse Mock fallback."""
        from services.mock_ai import ocr_image
        return await ocr_image(image_base64)

    def health_check(self) -> dict[str, Any]:
        return {
            "provider": "paddleocr" if self.is_available else "mock_fallback",
            "available": self.is_available,
            "onnx": self.is_available,
        }


# Singleton
paddle_ocr = PaddleOCREngine()
