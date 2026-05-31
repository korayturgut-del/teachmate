"""Dijital Öğretmen Asistanı — Maarif Performans Router

Süreç-odaklı performans değerlendirme endpoint'leri.
Eski HTML'deki MAARIF_AI_WORKER'ın yerine geçer — aynı istek/yanıt
şeması, böylece maarif-performans JS modülü sorunsuz çağırır.

Endpoint'ler:
  POST /api/maarif/evaluate  — EDE çerçevesi performans değerlendirme
  POST /api/maarif/exam      — sınav kağıdı okuma + puanlama
  GET  /api/maarif/framework — Maarif Modeli çerçeve bilgisi (eğilimler, değerler)
  GET  /api/maarif/health    — servis durumu
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from ai.performans.evaluator import performans_evaluator
from ai.performans.prompts import (
    CATI_DEGERLER, EGILIMLER, BECERILER, GRADE_TYPE_FOCUS,
)

router = APIRouter()


# ── İstek Modelleri ─────────────────────────────────────────

class PerformanceEvalRequest(BaseModel):
    """Performans değerlendirme isteği — eski 'maarif_photo_evaluate' modu."""
    grade_type: str = Field(..., description="sinifIciEtkinlik | ozDegerlendirme | proje")
    observation: str = Field("", description="Öğretmen gözlemi")
    student_name: str = Field("Öğrenci", description="Öğrenci adı (anonim olabilir)")
    image_base64: Optional[str] = Field(None, description="Opsiyonel fotoğraf kanıtı")


class ExamQuestion(BaseModel):
    num: int
    soru: str = ""
    cevap: str = ""
    puan: int = 25


class ExamAnalyzeRequest(BaseModel):
    """Sınav okuma isteği — eski 'exam_analyze_v2' modu."""
    questions: list[ExamQuestion]
    image_base64: Optional[str] = Field(None, description="Sınav kağıdı fotoğrafı")
    student_name: str = Field("Öğrenci")


# ── Endpoint'ler ────────────────────────────────────────────

@router.post("/evaluate")
async def evaluate_performance(payload: PerformanceEvalRequest):
    """EDE çerçevesinde performans değerlendirir.

    Çıktı şeması eski HTML ile birebir aynı — JS modülü
    maarifPhotoShowResult() değişmeden çalışır.
    """
    if payload.grade_type not in GRADE_TYPE_FOCUS:
        # Bilinmeyen tür de kabul edilir ama uyarı verilir
        pass

    result = await performans_evaluator.evaluate_performance(
        grade_type=payload.grade_type,
        observation=payload.observation,
        student_name=payload.student_name,
        image_base64=payload.image_base64,
    )
    return result


@router.post("/exam")
async def analyze_exam(payload: ExamAnalyzeRequest):
    """Sınav kağıdını okur ve soru bazlı puanlar.

    Çıktı şeması eski HTML 'exam_analyze_v2' ile uyumlu.
    """
    if not payload.questions:
        raise HTTPException(status_code=400, detail="En az bir soru gerekli.")

    result = await performans_evaluator.analyze_exam(
        questions=[q.model_dump() for q in payload.questions],
        image_base64=payload.image_base64,
        student_name=payload.student_name,
    )
    return result


@router.get("/framework")
async def get_framework():
    """Maarif Modeli çerçeve bilgisi — UI etiket/rozet üretimi için."""
    return {
        "model": "Türkiye Yüzyılı Maarif Modeli",
        "approach": "Erdem-Değer-Eylem (EDE)",
        "cati_degerler": CATI_DEGERLER,
        "egilimler": EGILIMLER,
        "egilim_sayisi": sum(len(v) for v in EGILIMLER.values()),
        "beceriler": BECERILER,
        "grade_types": GRADE_TYPE_FOCUS,
    }


@router.get("/health")
async def maarif_health():
    """Servis sağlık durumu + aktif AI sağlayıcı."""
    return {
        "service": "maarif",
        "active_provider": performans_evaluator.active_provider,
        "framework": "Erdem-Değer-Eylem",
        "modes": ["evaluate", "exam"],
    }
