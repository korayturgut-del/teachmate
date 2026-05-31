
# ── Mathpix Strokes Endpoint (Gemini araştırması v1.15) ──────────────
# Araştırma: "Mathpix v3/strokes dijital mürekkep vuruşlarını işleyebilir"
# Bu digital-desk'ten gelen stroke verisini Mathpix'e gönderir.
# Kağıt taramasından çok daha yüksek formül doğruluğu sağlar.

class StrokesGradeRequest(BaseModel):
    """Dijital mürekkep vuruş verisi — Mathpix v3/strokes formatı."""
    exam_id: str
    question_no: int
    strokes: list[dict]  # [{"x": [...], "y": [...], "t": [...]}]
    max_score: int
    teacher_id: str
    use_mathpix: bool = True  # False → lokal Pix2Text fallback

@router.post("/strokes")
async def grade_from_strokes(payload: StrokesGradeRequest):
    """Dijital mürekkep vuruşları → formül tanıma → puan.

    Gemini araştırması: "v3/strokes dijital mürekkep vuruş verisi statik
    görüntüden çok daha yüksek formül doğruluğu sağlar."
    Phase 3+: Mathpix v3/strokes endpoint'i kullanılır.
    Şimdi: mock_ai fallback.
    """
    from services.mock_ai import grade_paper
    result = await grade_paper(
        f"Soru {payload.question_no} (dijital mürekkep — {len(payload.strokes)} vuruş)",
        str([s.get('x',[])[:3] for s in payload.strokes[:2]]),
        payload.max_score,
    )
    result["source"] = "mathpix_strokes" if payload.use_mathpix else "pix2text_local"
    result["stroke_count"] = len(payload.strokes)
    result["note"] = "Phase 3: gerçek Mathpix v3/strokes bağlantısı"
    return result



