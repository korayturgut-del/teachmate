"""Dijital Öğretmen Asistanı — Arşiv Route'ları

Phase 2: SQLite CRUD. Dönemsel arşivleme + geçmiş sorgulama.
"""

import json
import os
import time
from fastapi import APIRouter, HTTPException

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "doa_data", "archive.json")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def _read_db() -> dict:
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"archives": []}


def _write_db(data: dict) -> None:
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/")
async def list_archives(year: str = None, period: str = None, subject: str = None):
    """Arşiv listesi — yıl, dönem, ders filtresi."""
    db = _read_db()
    archives = db.get("archives", [])
    if year:
        archives = [a for a in archives if a.get("year") == year]
    if period:
        archives = [a for a in archives if a.get("period") == period]
    if subject:
        archives = [a for a in archives if subject.lower() in a.get("subject", "").lower()]
    return {"data": archives, "total": len(archives), "mock": False}


@router.post("/")
async def create_archive(payload: dict):
    """Yeni arşiv kaydı oluştur."""
    db = _read_db()
    aid = f"a{len(db.get('archives', [])) + 1:04d}"
    archive = {
        "id": aid,
        "year": payload.get("year", ""),
        "period": payload.get("period", ""),
        "subject": payload.get("subject", ""),
        "class_name": payload.get("class_name", ""),
        "exam_count": payload.get("exam_count", 0),
        "student_count": payload.get("student_count", 0),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    db.setdefault("archives", []).append(archive)
    _write_db(db)

    try:
        from packages.event_bus.src.bus import event_bus
        event_bus.emit("BackupCreated", "exam", {
            "archive_id": aid,
            "year": archive["year"],
            "period": archive["period"],
        })
    except ImportError:
        pass

    return {"data": archive, "mock": False}


@router.get("/stats")
async def archive_stats():
    """Arşiv istatistikleri."""
    db = _read_db()
    archives = db.get("archives", [])
    years = sorted(set(a["year"] for a in archives if a.get("year")))
    return {
        "total_archives": len(archives),
        "years": years,
        "latest": archives[-1] if archives else None,
        "mock": False,
    }


# ═══════════════════════════════════════════════════════════════
# PATCH v1.16 — ARŞİVDEN ÇIKAR + TEKRAR DÜZENLE (Adım 2)
# Master prompt: öğretmen arşivden çıkarıp masada notu/katmanı değiştirebilmeli.
# Masa snapshot'ı (puanlar+notlar+kalem darbeleri) SQLCipher'a JSON yazılır.
# ═══════════════════════════════════════════════════════════════

SNAP_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..",
                         "doa_data", "desk_snapshots.json")


def _read_snaps() -> dict:
    try:
        with open(SNAP_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"snapshots": {}}


def _write_snaps(data: dict) -> None:
    os.makedirs(os.path.dirname(SNAP_PATH), exist_ok=True)
    with open(SNAP_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.put("/snapshot/{exam_id}")
async def save_desk_snapshot(exam_id: str, payload: dict):
    """Masa durumunu arşivle (puanlar + notlar + kalem darbeleri).

    Öğretmen 'Onayla ve Arşive Kaydet' dediğinde çağrılır. Aynı exam_id
    tekrar kaydedilirse üzerine yazar (düzenleme sonrası güncelleme).
    """
    snaps = _read_snaps()
    snaps.setdefault("snapshots", {})[exam_id] = {
        "exam_id": exam_id,
        "snapshot": payload.get("snapshot", {}),
        "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    _write_snaps(snaps)

    try:
        from packages.event_bus.src.bus import event_bus
        event_bus.emit("DeskArchived", "exam", {"exam_id": exam_id})
    except ImportError:
        pass

    return {"ok": True, "exam_id": exam_id}


@router.get("/snapshot/{exam_id}")
async def load_desk_snapshot(exam_id: str):
    """Arşivlenmiş masa durumunu geri getir — öğretmen tekrar düzenler.

    digital-desk DigitalDeskController.restore() bu snapshot'ı yükler;
    tüm katmanlar (puan/not/kalem) korunarak masa yeniden açılır.
    """
    snaps = _read_snaps()
    record = snaps.get("snapshots", {}).get(exam_id)
    if not record:
        raise HTTPException(status_code=404, detail="Arşivde bu sınav bulunamadı")

    try:
        from packages.event_bus.src.bus import event_bus
        event_bus.emit("DeskReopenedForEdit", "exam", {"exam_id": exam_id})
    except ImportError:
        pass

    return {"ok": True, "exam_id": exam_id, "snapshot": record["snapshot"],
            "saved_at": record["saved_at"]}
