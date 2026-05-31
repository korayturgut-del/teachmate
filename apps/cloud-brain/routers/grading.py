"""Dijital Öğretmen Asistanı — AI Grading Router

Phase 3: DeepSeek gerçek puanlama endpoint'i.
Güven eşiği (Kural 12) burada uygulanır.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

from ai.yazili_okuma.reader import yazili_okuma_reader

router = APIRouter()


# ── Request/Response Modelleri ──────────────────────────────

class GradingRequest(BaseModel):
    question: str = Field(..., description="Soru metni")
    answer: str = Field("", description="Öğrenci yanıtı")
    max_score: int = Field(..., ge=0, description="Maksimum puan")
    subject: str = Field("", description="Ders adı")
    rubric: Optional[dict] = Field(None, description="Rubrik kriterleri")
    exam_id: Optional[str] = Field(None)
    question_no: Optional[int] = Field(None)
    student_id: Optional[str] = Field(None)


class GradingResponse(BaseModel):
    score: int
    max_score: int
    explanation: str
    confidence: float
    confidence_band: str  # "high" | "mid" | "low"
    review_required: bool
    provider: str
    partial_credits: list = []


class BatchGradingRequest(BaseModel):
    papers: List[GradingRequest]
    concurrency: int = Field(3, ge=1, le=10)


class BatchGradingResponse(BaseModel):
    results: List[GradingResponse]
    total_score: int
    total_max_score: int
    provider: str


# ── Endpoint'ler ────────────────────────────────────────────

@router.post("/grade", response_model=GradingResponse)
async def grade_single(request: GradingRequest):
    """Tek soru puanla — DeepSeek veya Mock AI fallback.

    Kural 12: confidence < 0.70 ise review_required=True.
    """
    result = await yazili_okuma_reader.grade_question(
        question=request.question,
        answer=request.answer,
        max_score=request.max_score,
        rubric=request.rubric,
        subject=request.subject,
    )

    # Event Bus'a bildir
    try:
        from packages.event_bus.src.bus import event_bus
        event_bus.emit("AIGradingCompleted", "grade", {
            "exam_id": request.exam_id,
            "question_no": request.question_no,
            "student_id": request.student_id,
            "score": result["score"],
            "confidence": result["confidence"],
            "confidence_band": result["confidence_band"],
            "review_required": result["review_required"],
            "provider": result.get("provider", "unknown"),
        })
        if result.get("review_required"):
            event_bus.emit("TeacherReviewStarted", "grade", {
                "trigger": "low_confidence",
                "confidence": result["confidence"],
                "question_no": request.question_no,
            })
    except ImportError:
        pass

    return GradingResponse(
        score=result["score"],
        max_score=result["max_score"],
        explanation=result.get("explanation", ""),
        confidence=result["confidence"],
        confidence_band=result["confidence_band"],
        review_required=result["review_required"],
        provider=result.get("provider", "mock"),
        partial_credits=result.get("partial_credits", []),
    )


@router.post("/grade/batch", response_model=BatchGradingResponse)
async def grade_batch(request: BatchGradingRequest):
    """Toplu puanlama — paralel istekler."""
    papers = [
        {
            "question": p.question,
            "answer": p.answer,
            "max_score": p.max_score,
            "subject": p.subject,
            "rubric": p.rubric,
        }
        for p in request.papers
    ]

    results = await yazili_okuma_reader.grade_batch(papers)

    graded = [
        GradingResponse(
            score=r["score"],
            max_score=r["max_score"],
            explanation=r.get("explanation", ""),
            confidence=r["confidence"],
            confidence_band=r["confidence_band"],
            review_required=r["review_required"],
            provider=r.get("provider", "mock"),
            partial_credits=r.get("partial_credits", []),
        )
        for r in results
    ]

    total = sum(r.score for r in graded)
    total_max = sum(r.max_score for r in graded)

    return BatchGradingResponse(
        results=graded,
        total_score=total,
        total_max_score=total_max,
        provider=graded[0].provider if graded else "mock",
    )


@router.get("/health")
async def grading_health():
    """Grading servis sağlık durumu."""
    return {
        "service": "yazili_okuma",
        "provider": yazili_okuma_reader.active_provider,
        "available": yazili_okuma_reader.active_provider != "none",
    }


# ── v1.15: Mathpix Strokes Endpoint (Gemini araştırması) ─────────────
# "v3/strokes dijital mürekkep vuruşlarını işleyebilir"
# Stroke verisi statik görüntüden çok daha yüksek formül doğruluğu sağlar.

class StrokesGradeRequest(BaseModel):
    exam_id: str
    question_no: int
    strokes: list[dict]   # [{"x":[...], "y":[...], "t":[...]}]
    max_score: int = Field(default=10, ge=1)
    teacher_id: str
    use_mathpix: bool = True


@router.post("/strokes")
async def grade_from_strokes(payload: StrokesGradeRequest):
    """Dijital mürekkep vuruşları → Mathpix v3/strokes → LaTeX → puan.

    Gemini araştırması (Mayıs 2026): "Mathpix, dijital mürekkep vuruş
    verilerini (stroke order, hız) işleyerek formül tanıma doğruluğunu
    statik görüntülere kıyasla kritik düzeyde artırır."

    Phase 3+: gerçek Mathpix API_KEY ile aktif olur.
    Şimdi: mock_ai fallback (aynı response şeması).
    """
    from services.mock_ai import grade_paper
    question_desc = f"Soru {payload.question_no} — dijital mürekkep ({len(payload.strokes)} vuruş)"
    stroke_summary = str([s.get("x", [])[:3] for s in payload.strokes[:2]])

    result = await grade_paper(question_desc, stroke_summary, payload.max_score)
    result["source"] = "mathpix_strokes" if payload.use_mathpix else "pix2text_local"
    result["stroke_count"] = len(payload.strokes)
    result["note"] = "Phase 3: gerçek Mathpix v3/strokes — MATHPIX_API_KEY ile aktif"
    return result
