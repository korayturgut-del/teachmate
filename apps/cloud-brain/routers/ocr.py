"""Dijital Öğretmen Asistanı — OCR Router

Phase 3: PaddleOCR ONNX endpoint'i.
Görüntü → Metin + Öğrenci bilgisi çıkarma.
"""

import base64
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional

from services.paddleocr import paddle_ocr

router = APIRouter()


# ── Modeller ────────────────────────────────────────────────

class OCRRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 kodlu görüntü")
    fast: bool = Field(True, description="Hızlı model kullan")


class OCRResponse(BaseModel):
    text: str
    confidence: float
    word_count: int
    lines: list = []
    provider: str


class StudentInfoResponse(BaseModel):
    student_name: Optional[str] = None
    student_no: Optional[str] = None
    class_name: Optional[str] = None
    school: Optional[str] = None
    ocr_confidence: float
    provider: str


# ── Endpoint'ler ────────────────────────────────────────────

@router.post("/extract-text", response_model=OCRResponse)
async def extract_text(request: OCRRequest):
    """Görüntüden metin çıkar."""
    result = await paddle_ocr.extract_text(
        request.image_base64, fast=request.fast
    )

    if result.get("fallback_reason"):
        raise HTTPException(
            status_code=422,
            detail=f"OCR kullanılamadı: {result['fallback_reason']}"
        )

    return OCRResponse(
        text=result["text"],
        confidence=result["confidence"],
        word_count=result["word_count"],
        lines=result.get("lines", []),
        provider=result.get("provider", "mock"),
    )


@router.post("/extract-student-info", response_model=StudentInfoResponse)
async def extract_student_info(request: OCRRequest):
    """Görüntüden öğrenci bilgisi çıkar (isim, numara, sınıf)."""
    result = await paddle_ocr.extract_student_info(request.image_base64)

    return StudentInfoResponse(
        student_name=result.get("student_name"),
        student_no=result.get("student_no"),
        class_name=result.get("class_name"),
        school=result.get("school"),
        ocr_confidence=result.get("ocr_confidence", 0.0),
        provider=result.get("provider", "mock"),
    )


@router.post("/upload")
async def ocr_upload(file: UploadFile = File(...)):
    """Dosya yükle ve OCR yap."""
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode("utf-8")
    result = await paddle_ocr.extract_text(image_base64)

    return {
        "filename": file.filename,
        "size_bytes": len(contents),
        "ocr": {
            "text": result["text"],
            "confidence": result["confidence"],
            "word_count": result["word_count"],
            "provider": result.get("provider", "mock"),
        },
    }


@router.get("/health")
async def ocr_health():
    """OCR servis sağlık durumu."""
    return paddle_ocr.health_check()
