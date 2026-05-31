"""Dijital Öğretmen Asistanı — Maarif Gelişmiş Router (v2.0)

Maarif OS'in gelişmiş yetenekleri (eski router korunur):
  - Kanıt defteri (event recording)
  - Çift ses kayıt (öğrenci beyanı + öğretmen yorumu)
  - Örüntü analizi
  - Sene sonu tahmin + onay/ezme + silinemez damga
  - Sentetik veri fabrikası önizleme
  - Ontoloji önizleme
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ai.performans.evidence_ledger import AccountabilityGate
from ai.performans.evaluator import performans_evaluator
from ai.performans.prompts import BEHAVIOR_SEED_DATABASE, MAARIF_ONTOLOGY_TREE
from ai.performans.storage import EvidenceRepository, PersistentLedger
from ai.performans import data_factory

router = APIRouter()

_repo = EvidenceRepository()
_ledger = PersistentLedger(_repo)
_gate = AccountabilityGate(_ledger)


@router.get("/meta")
async def get_meta():
    return {
        "ontology": MAARIF_ONTOLOGY_TREE,
        "behavior_seeds_count": len(BEHAVIOR_SEED_DATABASE),
        "active_provider": performans_evaluator.active_provider,
    }


class EventRecord(BaseModel):
    student_id: str
    raw_text: str
    student_label: str = "Öğrenci"
    student_statement: Optional[str] = None
    teacher_comment: Optional[str] = None


@router.post("/events")
async def record_event(payload: EventRecord):
    try:
        event = _ledger.record_event(
            student_id=payload.student_id,
            raw_text=payload.raw_text,
            student_label=payload.student_label,
            student_statement=payload.student_statement,
            teacher_comment=payload.teacher_comment,
        )
        return event.to_dict()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/events/{student_id}")
async def list_events(student_id: str):
    events = _ledger.get_events(student_id)
    return {
        "student_id": student_id,
        "events": [e.to_dict() for e in events],
        "count": len(events),
    }


class DualVoiceResponse(BaseModel):
    event_id: str
    student_statement: Optional[str] = None
    teacher_comment: Optional[str] = None


@router.post("/events/responses")
async def add_dual_voice(payload: DualVoiceResponse):
    try:
        _repo.update_event_responses(
            event_id=payload.event_id,
            student_statement=payload.student_statement,
            teacher_comment=payload.teacher_comment,
        )
        return {"status": "saved", "event_id": payload.event_id}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/pattern/{student_id}")
async def pattern_analysis(student_id: str):
    return _ledger.analyze_pattern(student_id)


@router.get("/yearend/{student_id}")
async def yearend_prediction(student_id: str):
    asm = _gate.generate_year_end(student_id)
    return asm.to_dict()


class YearEndVerdict(BaseModel):
    student_id: str
    decision: str  # "confirm" | "override"
    teacher_score: Optional[int] = None
    justification: Optional[str] = None


@router.post("/yearend/verdict")
async def yearend_verdict(payload: YearEndVerdict):
    try:
        asm = _gate.generate_year_end(payload.student_id)
        if payload.decision == "confirm":
            asm = _gate.teacher_confirm(asm)
        elif payload.decision == "override":
            if payload.teacher_score is None:
                raise HTTPException(400, "override için teacher_score gerekli")
            asm = _gate.teacher_override(
                asm,
                teacher_score=int(payload.teacher_score),
                justification=payload.justification,
            )
        else:
            raise HTTPException(400, "decision 'confirm' veya 'override' olmalı")
        _repo.save_assessment(asm, lock=True)
        return asm.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/factory/preview")
async def factory_preview(count: int = 5, seed: int = 42):
    count = max(1, min(count, 50))
    records = data_factory.generate(
        target_count=count, seed=seed, include_seed_originals=False,
    )
    return {"count": len(records), "seed": seed, "records": records[:count]}
