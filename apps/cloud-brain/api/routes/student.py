"""Dijital Öğretmen Asistanı — Öğrenci Route'ları

Phase 2: SQLite CRUD. Phase 4: SQLCipher şifreli depolama.
"""

import json
import os
import time
from fastapi import APIRouter, HTTPException

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "doa_data", "students.json")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def _read_db() -> dict:
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"students": []}


def _write_db(data: dict) -> None:
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/")
async def list_students(school_id: int = None, class_name: str = None, search: str = None):
    """Öğrenci listesi — okul, sınıf ve arama filtresi."""
    db = _read_db()
    students = db.get("students", [])
    if school_id:
        students = [s for s in students if s.get("school_id") == school_id]
    if class_name:
        students = [s for s in students if class_name.lower() in s.get("class_name", "").lower()]
    if search and len(search) >= 2:
        q = search.lower()
        students = [s for s in students if q in s.get("name", "").lower() or q in str(s.get("school_no", ""))]
    return {"data": students, "total": len(students), "mock": False}


@router.get("/{student_id}")
async def get_student(student_id: str):
    """Öğrenci detayı."""
    db = _read_db()
    for student in db.get("students", []):
        if student["id"] == student_id:
            return {"data": student, "mock": False}
    raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")


@router.post("/")
async def create_student(payload: dict):
    """Yeni öğrenci ekle."""
    db = _read_db()
    sid = f"s{len(db.get('students', [])) + 1:04d}"
    student = {
        "id": sid,
        "school_id": payload.get("school_id"),
        "school_no": payload.get("school_no", ""),
        "name": payload.get("name", "İsimsiz"),
        "class_name": payload.get("class_name", ""),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    db.setdefault("students", []).append(student)
    _write_db(db)
    return {"data": student, "mock": False}


@router.get("/{student_id}/history")
async def get_student_history(student_id: str):
    """Öğrenci sınav geçmişi."""
    # Phase 2: exams.json'dan çapraz sorgu
    exams_path = DB_PATH.replace("students.json", "exams.json")
    try:
        with open(exams_path, "r", encoding="utf-8") as f:
            edb = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"data": [], "mock": False}

    results = [r for r in edb.get("results", []) if r.get("student_id") == student_id]
    return {"student_id": student_id, "data": results, "total": len(results), "mock": False}
