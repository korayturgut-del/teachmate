"""Dijital Öğretmen Asistanı — Sınav Route'ları

Phase 2: SQLite CRUD (JSON-file bridge, Phase 4'te SQLCipher'a geçer).
Mock yanıtlar kaldırıldı — gerçek veritabanı işlemleri.
"""

import json
import os
import time
from fastapi import APIRouter, HTTPException

router = APIRouter()

# Phase 2: JSON dosyası tabanlı basit depolama (Phase 4: SQLCipher)
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "doa_data", "exams.json")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def _read_db() -> dict:
    """Veritabanından oku (Phase 2: JSON, Phase 4: SQLCipher)."""
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"exams": [], "results": []}


def _write_db(data: dict) -> None:
    """Veritabanına yaz."""
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _next_id(items: list) -> str:
    """Basit ID üretici."""
    return f"e{len(items) + 1:04d}"


# ── Sınav CRUD ──────────────────────────────────────────────

@router.get("/")
async def list_exams(subject: str = None, class_name: str = None):
    """Sınavları listele — filtreleme destekli."""
    db = _read_db()
    exams = db.get("exams", [])
    if subject:
        exams = [e for e in exams if subject.lower() in e.get("subject", "").lower()]
    if class_name:
        exams = [e for e in exams if class_name.lower() in e.get("class_name", "").lower()]
    return {"data": exams, "total": len(exams), "mock": False}


@router.get("/{exam_id}")
async def get_exam(exam_id: str):
    """Tek sınav detayı."""
    db = _read_db()
    for exam in db.get("exams", []):
        if exam["id"] == exam_id:
            # İlişkili sonuçları da getir
            results = [r for r in db.get("results", []) if r.get("exam_id") == exam_id]
            return {"data": exam, "results": results, "mock": False}
    raise HTTPException(status_code=404, detail="Sınav bulunamadı")


@router.post("/")
async def create_exam(payload: dict):
    """Yeni sınav oluştur."""
    db = _read_db()
    exam_id = _next_id(db.get("exams", []))
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    exam = {
        "id": exam_id,
        "title": payload.get("title", "İsimsiz Sınav"),
        "subject": payload.get("subject", ""),
        "exam_type": payload.get("exam_type", "yazili_1"),
        "class_name": payload.get("class_name", ""),
        "year": payload.get("year", ""),
        "period": payload.get("period", ""),
        "total_questions": payload.get("total_questions", 0),
        "max_score": payload.get("max_score", 100.0),
        "status": "beklemede",
        "created_at": now,
        "updated_at": now,
    }
    db.setdefault("exams", []).append(exam)
    _write_db(db)

    # Event Bus'a bildir
    try:
        from packages.event_bus.src.bus import event_bus
        event_bus.emit("ExamCreated", "exam", {"exam_id": exam_id}, {"source": "api"})
    except ImportError:
        pass

    return {"data": exam, "mock": False}


@router.put("/{exam_id}")
async def update_exam(exam_id: str, payload: dict):
    """Sınav güncelle."""
    db = _read_db()
    for i, exam in enumerate(db.get("exams", [])):
        if exam["id"] == exam_id:
            exam.update({
                "title": payload.get("title", exam["title"]),
                "subject": payload.get("subject", exam["subject"]),
                "status": payload.get("status", exam["status"]),
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            })
            db["exams"][i] = exam
            _write_db(db)
            return {"data": exam, "mock": False}
    raise HTTPException(status_code=404, detail="Sınav bulunamadı")


@router.delete("/{exam_id}")
async def delete_exam(exam_id: str):
    """Sınav sil."""
    db = _read_db()
    exams = db.get("exams", [])
    db["exams"] = [e for e in exams if e["id"] != exam_id]
    db["results"] = [r for r in db.get("results", []) if r.get("exam_id") != exam_id]
    _write_db(db)
    return {"deleted": True, "exam_id": exam_id, "mock": False}


# ── Sınav Sonuçları ─────────────────────────────────────────

@router.post("/{exam_id}/results")
async def add_exam_result(exam_id: str, payload: dict):
    """Sınava sonuç ekle."""
    db = _read_db()
    # Sınav var mı kontrol et
    exam_exists = any(e["id"] == exam_id for e in db.get("exams", []))
    if not exam_exists:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    result_id = _next_id(db.get("results", []))
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    result = {
        "id": result_id,
        "exam_id": exam_id,
        "student_id": payload.get("student_id", ""),
        "student_name": payload.get("student_name", ""),
        "total_score": payload.get("total_score", 0),
        "max_score": payload.get("max_score", 100),
        "answers": payload.get("answers", []),
        "ai_evaluation": payload.get("ai_evaluation"),
        "status": "ai_completed",
        "created_at": now,
    }
    db.setdefault("results", []).append(result)
    _write_db(db)

    try:
        from packages.event_bus.src.bus import event_bus
        event_bus.emit("AIGradingCompleted", "grade", {
            "result_id": result_id,
            "exam_id": exam_id,
            "score": result["total_score"],
        })
        event_bus.emit("GradeFinalized", "grade", {
            "result_id": result_id,
            "final_score": result["total_score"],
        })
    except ImportError:
        pass

    return {"data": result, "mock": False}


@router.get("/{exam_id}/results")
async def list_exam_results(exam_id: str):
    """Sınav sonuçlarını listele."""
    db = _read_db()
    results = [r for r in db.get("results", []) if r.get("exam_id") == exam_id]
    return {"data": results, "total": len(results), "mock": False}
