"""Maarif OS — Performans AI HTTP API (FastAPI)

ai/performans/api.py

Tüm beyin yeteneklerini HTTP olarak açar. HİÇBİR ÖZELLİK KAYBI YOK:
  - Tek-olay değerlendirme (çoklu ajan + rubric fallback)
  - Kanıt defteri: olay kaydı + AI'ın "neden?" sorusu
  - Çift ses kaydı (öğrenci beyanı + öğretmen yorumu)
  - Örüntü analizi (sene boyu birikim)
  - Sene sonu değerlendirme + silinemez ezme damgası
  - Provider durumu, ontoloji/seed gözatımı, veri fabrikası

Çalıştırma:  uvicorn ai.performans.api:app --reload
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from ai.ortak.provider import ai_provider
from ai.performans.evaluator import performans_evaluator
from ai.performans.storage import EvidenceRepository, PersistentLedger
from ai.performans.evidence_ledger import AccountabilityGate, AMBIGUOUS_ACTION_PATTERNS
from ai.performans.prompts import (
    BEHAVIOR_SEED_DATABASE, MAARIF_ONTOLOGY_TREE, GRADE_TYPE_FOCUS,
)

app = FastAPI(title="Maarif OS — Performans AI", version="2.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# Tek öğretmenli sistem → tek paylaşılan defter
_repo = EvidenceRepository()
_ledger = PersistentLedger(_repo)
_gate = AccountabilityGate(_ledger)


# ── Şemalar ──────────────────────────────────────────────────────────────────
class EvaluateIn(BaseModel):
    grade_type: str = "sinifIciEtkinlik"
    observation: str
    student_name: str = "Öğrenci"
    image_base64: Optional[str] = None


class EventIn(BaseModel):
    student_id: str
    raw_text: str
    student_label: str = "Öğrenci"
    student_statement: Optional[str] = None
    teacher_comment: Optional[str] = None


class ResponsesIn(BaseModel):
    event_id: str
    student_statement: Optional[str] = None
    teacher_comment: Optional[str] = None


class VerdictIn(BaseModel):
    student_id: str
    action: str                       # "confirm" | "override"
    teacher_score: Optional[int] = None
    justification: Optional[str] = None


# ── Sağlık & meta ──────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "provider": ai_provider.status()}


@app.get("/api/meta")
def meta():
    return {
        "grade_types": GRADE_TYPE_FOCUS,
        "values": list(MAARIF_ONTOLOGY_TREE.keys()),
        "ontology": MAARIF_ONTOLOGY_TREE,
        "seed_count": len(BEHAVIOR_SEED_DATABASE),
        "ambiguity_categories": sorted({p["kategori"] for p in AMBIGUOUS_ACTION_PATTERNS}),
        "provider": ai_provider.active,
    }


# ── Tek-olay değerlendirme ───────────────────────────────────────────────────
@app.post("/api/evaluate")
async def evaluate(body: EvaluateIn):
    return await performans_evaluator.evaluate_performance(
        grade_type=body.grade_type, observation=body.observation,
        student_name=body.student_name, image_base64=body.image_base64,
    )


# ── Kanıt defteri ────────────────────────────────────────────────────────────
@app.post("/api/events")
def add_event(body: EventIn):
    ev = _ledger.record_event(
        student_id=body.student_id, raw_text=body.raw_text,
        student_label=body.student_label,
        student_statement=body.student_statement,
        teacher_comment=body.teacher_comment,
    )
    return ev.to_dict()


@app.get("/api/events/{student_id}")
def list_events(student_id: str):
    return [e.to_dict() for e in _ledger.get_events(student_id)]


@app.post("/api/events/responses")
def add_responses(body: ResponsesIn):
    _repo.update_event_responses(
        body.event_id, student_statement=body.student_statement,
        teacher_comment=body.teacher_comment,
    )
    return {"ok": True, "event_id": body.event_id}


@app.get("/api/pattern/{student_id}")
def pattern(student_id: str):
    return _ledger.analyze_pattern(student_id)


# ── Sene sonu + hesap verebilirlik ──────────────────────────────────────────
@app.get("/api/yearend/{student_id}")
def yearend_preview(student_id: str):
    existing = _repo.load_assessment(student_id)
    if existing:
        return {"saved": True, **existing}
    asm = _gate.generate_year_end(student_id)
    return {"saved": False, **asm.to_dict()}


@app.post("/api/yearend/verdict")
def yearend_verdict(body: VerdictIn):
    if _repo.is_locked(body.student_id):
        raise HTTPException(409, "Bu değerlendirme mühürlü; değiştirilemez.")
    asm = _gate.generate_year_end(body.student_id)
    if body.action == "confirm":
        asm = _gate.teacher_confirm(asm)
    elif body.action == "override":
        if body.teacher_score is None:
            raise HTTPException(400, "override için teacher_score gerekli.")
        asm = _gate.teacher_override(asm, body.teacher_score, body.justification)
    else:
        raise HTTPException(400, "action 'confirm' veya 'override' olmalı.")
    _repo.save_assessment(asm, lock=True)   # karar mühürlenir
    return asm.to_dict()


# ── Veri fabrikası ───────────────────────────────────────────────────────────
@app.get("/api/factory/preview")
def factory_preview(count: int = 200, seed: int = 42):
    from ai.performans.data_factory import generate
    corpus = generate(target_count=min(count, 5000), seed=seed)
    from collections import Counter
    return {
        "uretilen": len(corpus),
        "deger_dagilimi": dict(Counter(r["deger"] for r in corpus)),
        "ornekler": corpus[:5],
    }


# ── Gömülü arayüz ────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def ui():
    import os
    here = os.path.dirname(__file__)
    idx = os.path.join(here, "frontend", "index.html")
    if os.path.exists(idx):
        with open(idx, encoding="utf-8") as f:
            return f.read()
    return "<h1>Maarif OS Performans API</h1><p>frontend/index.html bulunamadı.</p>"
