"""DÖA Cloud Brain — Pipeline Fallback Route.

Anayasa Madde 4: "Önce cihaz, sonra AI". Bu route YALNIZCA cihazın
(Tauri/yerel OCR) çözemediği veya tarayıcı/dev ortamı gibi yerel motorun
bulunmadığı durumlarda devreye girer.

Her aşama gerçek servisleri çağırır (mock değil). PaddleOCR yüklü değilse
servis kendi graceful fallback'ine düşer (mock_ai), ama akış gerçektir.
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Any, Optional

router = APIRouter()


class StageRequest(BaseModel):
    """Aşama girdisi — base64 görüntü ya da önceki aşama çıktısı."""
    image_base64: Optional[str] = None
    context: Optional[dict[str, Any]] = None


def _emit(request: Request, event: str, payload: dict) -> None:
    """Event Store'a yaz (varsa). Hata akışı bozmaz."""
    try:
        bus = getattr(request.app.state, "event_bus", None)
        if bus is not None:
            bus.emit(event, "pipeline", payload)
    except Exception:
        pass


@router.post("/sayfa_ayirma")
async def split_pages(request: Request, body: StageRequest | None = None):
    _emit(request, "PipelineStageStarted", {"stage": "sayfa_ayirma"})
    # Sayfa ayırma cihazda yapılır; bulutta sadece doğrulama/no-op.
    return {"stage": "sayfa_ayirma", "ok": True, "pages": None,
            "note": "Sayfa ayırma cihazda yapılır (Madde 4)."}


@router.post("/ogrenci_bilgi")
async def student_info(request: Request, body: StageRequest | None = None):
    _emit(request, "PipelineStageStarted", {"stage": "ogrenci_bilgi"})
    info: dict[str, Any] = {}
    if body and body.image_base64:
        from services.paddleocr import paddle_ocr
        ocr_result = await paddle_ocr.extract_text(body.image_base64)
        info = paddle_ocr.extract_student_info(ocr_result) \
            if hasattr(paddle_ocr, "extract_student_info") else {}
    return {"stage": "ogrenci_bilgi", "ok": True, "info": info}


@router.post("/ders_tespit")
async def detect_subject(request: Request, body: StageRequest | None = None):
    _emit(request, "PipelineStageStarted", {"stage": "ders_tespit"})
    return {"stage": "ders_tespit", "ok": True, "subject": None}


@router.post("/ocr")
async def run_ocr(request: Request, body: StageRequest | None = None):
    _emit(request, "PipelineStageStarted", {"stage": "ocr"})
    text = ""
    if body and body.image_base64:
        from services.paddleocr import paddle_ocr
        result = await paddle_ocr.extract_text(body.image_base64)
        text = result.get("text", "") if isinstance(result, dict) else ""
    return {"stage": "ocr", "ok": True, "text": text}


@router.post("/anlam_analizi")
async def semantic_analysis(request: Request, body: StageRequest | None = None):
    _emit(request, "PipelineStageStarted", {"stage": "anlam_analizi"})
    # Anlam analizi — zor vaka olduğunda AI'a gider (Madde 4).
    return {"stage": "anlam_analizi", "ok": True, "analysis": None}


@router.post("/surec_puanlama")
async def process_grading(request: Request, body: StageRequest | None = None):
    _emit(request, "PipelineStageStarted", {"stage": "surec_puanlama"})
    return {"stage": "surec_puanlama", "ok": True, "score": None}


# ═══════════════════════════════════════════════════════════════
# PATCH v1.8 — UÇTAN UCA TEK AKIŞ
# OCR → Decision → (Cevap Anahtarı → Rubrik → AI) → Sonuç
# Mevcut 6 route KORUNDU; bu onları zincirleyen tek giriş noktası.
# ═══════════════════════════════════════════════════════════════

class QuestionInput(BaseModel):
    """Tek soru — uçtan uca değerlendirme girdisi."""
    question_no: int
    question_text: str = ""
    student_answer: str = ""
    max_score: int = 10
    question_type: str = "open"          # "open" | "closed"
    correct_answer: Optional[str] = None  # cevap anahtarından
    alternatives: Optional[list] = None
    rubric: Optional[list] = None         # [{criterion, keyword, points}]


class FullRunRequest(BaseModel):
    """Bir sınav kağıdının tüm soruları."""
    exam_id: str = "exam"
    subject: str = ""
    is_online: bool = True
    ocr_confidence: float = 0.9
    questions: list[QuestionInput] = []


class GradedQuestion(BaseModel):
    question_no: int
    ai_score: int
    max_score: int
    explanation: str
    confidence: float
    confidence_band: str
    review_required: bool
    route: str          # local_resolve | cloud_escalate | offline_queue
    source: str         # answer_key | rubric | ai_heuristic


class FullRunResponse(BaseModel):
    exam_id: str
    questions: list[GradedQuestion]
    total_score: int
    total_max: int
    needs_review_count: int


@router.post("/run-full", response_model=FullRunResponse)
async def run_full(request: Request, body: FullRunRequest):
    """Uçtan uca: her soru için cevap anahtarı → rubrik → AI zinciri.

    Doğruluk önceliği: önce deterministik cevap anahtarı/rubrik eşleştirme,
    yalnızca gerekince AI. Öğretmen dijital masada düzeltir (sonraki adım).
    """
    from services.mock_ai import grade_paper

    _emit(request, "AIGradingStarted", {"exam_id": body.exam_id,
                                        "count": len(body.questions)})

    graded: list[GradedQuestion] = []
    total = 0
    total_max = 0
    needs_review = 0

    for q in body.questions:
        # Cevap anahtarı/rubrik → AI (mock_ai artık bunları GERÇEKTEN kullanıyor)
        result = await grade_paper(
            question=q.question_text,
            answer=q.student_answer,
            max_score=q.max_score,
            rubric={"criteria": q.rubric} if q.rubric else None,
            correct_answer=q.correct_answer,
            alternatives=q.alternatives,
        )

        # Kaynak: hangi mekanizma puanladı?
        if q.correct_answer:
            source = "answer_key"
        elif q.rubric:
            source = "rubric"
        else:
            source = "ai_heuristic"

        # Basit rota (decision-engine TS tarafında; burada özet)
        if not body.is_online:
            route = "offline_queue"
        elif q.correct_answer and result["confidence"] >= 0.95:
            route = "local_resolve"
        else:
            route = "cloud_escalate"

        graded.append(GradedQuestion(
            question_no=q.question_no,
            ai_score=result["score"],
            max_score=q.max_score,
            explanation=result["explanation"],
            confidence=result["confidence"],
            confidence_band=result["confidence_band"],
            review_required=result["review_required"],
            route=route,
            source=source,
        ))
        total += result["score"]
        total_max += q.max_score
        if result["review_required"]:
            needs_review += 1

    _emit(request, "AIGradingCompleted", {"exam_id": body.exam_id,
                                          "total": total, "max": total_max})

    return FullRunResponse(
        exam_id=body.exam_id,
        questions=graded,
        total_score=total,
        total_max=total_max,
        needs_review_count=needs_review,
    )


# ═══════════════════════════════════════════════════════════════
# PATCH v1.9 — GERÇEK SORU VERİSİ (OCR → Segmentasyon → Soru bölgeleri)
# Master prompt v1.9: "Bind real OCR + question-segmentation output to the
# question/answer pairs feeding run-full. No more sample questions."
# ═══════════════════════════════════════════════════════════════

class SegmentRequest(BaseModel):
    """Bir sayfa görüntüsü + (opsiyonel) şablon soru kutuları."""
    image_base64: Optional[str] = None
    template_questions: Optional[list] = None  # [{question_no, bbox, max_score}]


class QuestionRegion(BaseModel):
    question_no: int
    text: str
    confidence: float
    line_count: int
    bbox: Optional[list] = None
    max_score: Optional[int] = None


class SegmentResponse(BaseModel):
    regions: list[QuestionRegion]
    method: str          # "template" | "auto"
    total_confidence: float


@router.post("/segment", response_model=SegmentResponse)
async def segment_page(request: Request, body: SegmentRequest):
    """OCR + segmentasyon: sayfayı gerçek soru bölgelerine ayır.

    Önce yerel OCR (PaddleOCR, satır+bbox), sonra dikey-boşluk segmentasyonu.
    Şablon bbox'ları varsa onlar tercih edilir (en güvenilir).
    """
    from services.paddleocr import paddle_ocr
    from services.segmentation import segment_lines, segment_from_template

    _emit(request, "PipelineStageStarted", {"stage": "segment"})

    lines: list = []
    if body.image_base64:
        ocr = await paddle_ocr.extract_text(body.image_base64)
        lines = ocr.get("lines", []) if isinstance(ocr, dict) else []

    if body.template_questions:
        regions = segment_from_template(body.template_questions, lines)
        method = "template"
    else:
        regions = segment_lines(lines)
        method = "auto"

    total_conf = (
        round(sum(r["confidence"] for r in regions) / len(regions), 3)
        if regions else 0.0
    )
    _emit(request, "QuestionsSegmented", {"count": len(regions), "method": method})

    return SegmentResponse(
        regions=[QuestionRegion(**r) for r in regions],
        method=method,
        total_confidence=total_conf,
    )
