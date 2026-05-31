"""Maarif OS — Kalıcı Depolama Katmanı (SQLite)

ai/performans/storage.py

Kanıt defterini diske yazar. İki kritik garanti:
  1. Olaylar sene boyu KALICI saklanır (sunucu yeniden başlasa da kaybolmaz).
  2. Mühürlenen sene sonu kaydı DB seviyesinde KİLİTLENİR — öğretmen
     değiştiremez. 'is_locked=1' olan satır UPDATE'lenirse repository reddeder
     ve ayrıca SQLite trigger müdahaleyi engeller (savunma derinliği).

Üretimde Postgres'e taşımak için yalnızca _connect ve SQL lehçesi değişir;
arayüz (EvidenceRepository) sabit kalır.
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

from ai.performans.evidence_ledger import (
    ObservationEvent, YearEndAssessment, EvidenceLedger,
    detect_ambiguity, TeacherVerdict,
)
from ai.performans.rubric import MaarifRubric


DEFAULT_DB_PATH = os.environ.get("MAARIF_DB_PATH", "maarif_os.db")


_SCHEMA = """
CREATE TABLE IF NOT EXISTS observation_events (
    event_id          TEXT PRIMARY KEY,
    student_id        TEXT NOT NULL,
    student_label     TEXT NOT NULL DEFAULT 'Öğrenci',
    timestamp         TEXT NOT NULL,
    raw_text          TEXT NOT NULL,
    ai_probe_question TEXT,
    ambiguity_category TEXT,
    ambiguity_rationale TEXT,
    student_statement TEXT,
    teacher_comment   TEXT,
    matched_evidences TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_events_student ON observation_events(student_id);

CREATE TABLE IF NOT EXISTS year_end_assessments (
    student_id            TEXT PRIMARY KEY,
    created_at            TEXT NOT NULL,
    ai_predicted_score    INTEGER NOT NULL,
    ai_predicted_band     TEXT NOT NULL,
    ai_rationale          TEXT NOT NULL,
    evidence_summary      TEXT NOT NULL DEFAULT '{}',
    teacher_verdict       TEXT NOT NULL DEFAULT 'beklemede',
    teacher_final_score   INTEGER,
    teacher_justification TEXT,
    override_flag         INTEGER NOT NULL DEFAULT 0,
    override_direction    TEXT NOT NULL DEFAULT 'yok',
    override_magnitude    INTEGER NOT NULL DEFAULT 0,
    public_override_notice TEXT,
    is_locked             INTEGER NOT NULL DEFAULT 0
);

-- DB seviyesi savunma: kilitli kayıt güncellenemez. Öğretmen arayüzü
-- atlansa bile (doğrudan SQL), mühürlü satır değişmez.
CREATE TRIGGER IF NOT EXISTS prevent_locked_update
BEFORE UPDATE ON year_end_assessments
FOR EACH ROW
WHEN OLD.is_locked = 1
BEGIN
    SELECT RAISE(ABORT, 'Mühürlü değerlendirme kaydı değiştirilemez (Maarif OS hesap verebilirlik kilidi).');
END;
"""


class EvidenceRepository:
    """Kanıt defterinin kalıcı arayüzü."""

    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    # ── OLAY KAYDI ──────────────────────────────────────────────────────────
    def save_event(self, event: ObservationEvent) -> None:
        with self._connect() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO observation_events
                   (event_id, student_id, student_label, timestamp, raw_text,
                    ai_probe_question, ambiguity_category, ambiguity_rationale,
                    student_statement, teacher_comment, matched_evidences)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (event.event_id, event.student_id, event.student_label, event.timestamp,
                 event.raw_text, event.ai_probe_question, event.ambiguity_category,
                 event.ambiguity_rationale, event.student_statement,
                 event.teacher_comment, json.dumps(event.matched_evidences, ensure_ascii=False)),
            )

    def load_events(self, student_id: str) -> list[ObservationEvent]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM observation_events WHERE student_id=? ORDER BY timestamp",
                (student_id,),
            ).fetchall()
        return [self._row_to_event(r) for r in rows]

    def update_event_responses(
        self, event_id: str,
        student_statement: Optional[str] = None,
        teacher_comment: Optional[str] = None,
    ) -> None:
        """AI 'neden?' sorduktan sonra öğretmenin girdiği cevapları işler."""
        sets, vals = [], []
        if student_statement is not None:
            sets.append("student_statement=?"); vals.append(student_statement)
        if teacher_comment is not None:
            sets.append("teacher_comment=?"); vals.append(teacher_comment)
        if not sets:
            return
        vals.append(event_id)
        with self._connect() as conn:
            conn.execute(f"UPDATE observation_events SET {', '.join(sets)} WHERE event_id=?", vals)

    @staticmethod
    def _row_to_event(r: sqlite3.Row) -> ObservationEvent:
        return ObservationEvent(
            event_id=r["event_id"], student_id=r["student_id"],
            student_label=r["student_label"], timestamp=r["timestamp"],
            raw_text=r["raw_text"], ai_probe_question=r["ai_probe_question"],
            ambiguity_category=r["ambiguity_category"],
            ambiguity_rationale=r["ambiguity_rationale"],
            student_statement=r["student_statement"], teacher_comment=r["teacher_comment"],
            matched_evidences=json.loads(r["matched_evidences"]),
        )

    # ── SENE SONU DEĞERLENDİRME ─────────────────────────────────────────────
    def save_assessment(self, asm: YearEndAssessment, lock: bool = False) -> None:
        """Değerlendirmeyi kaydeder. lock=True ise DB seviyesinde mühürlenir."""
        existing = self.load_assessment(asm.student_id)
        if existing and existing.get("is_locked"):
            raise PermissionError(
                "Mühürlü değerlendirme kaydı değiştirilemez (hesap verebilirlik kilidi)."
            )
        with self._connect() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO year_end_assessments
                   (student_id, created_at, ai_predicted_score, ai_predicted_band, ai_rationale,
                    evidence_summary, teacher_verdict, teacher_final_score, teacher_justification,
                    override_flag, override_direction, override_magnitude, public_override_notice, is_locked)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (asm.student_id, datetime.now(timezone.utc).isoformat(),
                 asm.ai_predicted_score, asm.ai_predicted_band, asm.ai_rationale,
                 json.dumps(asm.evidence_summary, ensure_ascii=False),
                 asm.teacher_verdict, asm.teacher_final_score, asm.teacher_justification,
                 1 if asm.override_flag else 0, asm.override_direction, asm.override_magnitude,
                 asm.public_override_notice, 1 if lock else 0),
            )

    def load_assessment(self, student_id: str) -> Optional[dict[str, Any]]:
        with self._connect() as conn:
            r = conn.execute(
                "SELECT * FROM year_end_assessments WHERE student_id=?", (student_id,)
            ).fetchone()
        return dict(r) if r else None

    def is_locked(self, student_id: str) -> bool:
        rec = self.load_assessment(student_id)
        return bool(rec and rec["is_locked"])


class PersistentLedger(EvidenceLedger):
    """Bellek-içi EvidenceLedger'ın SQLite ile kalıcı hale getirilmiş sürümü.

    Aynı arayüz (record_event, get_events, analyze_pattern) korunur;
    fark: olaylar diske yazılır ve tekrar yüklenir.
    """

    def __init__(self, repo: Optional[EvidenceRepository] = None,
                 db_path: str = DEFAULT_DB_PATH):
        super().__init__()
        self.repo = repo or EvidenceRepository(db_path)

    def record_event(
        self, student_id: str, raw_text: str, student_label: str = "Öğrenci",
        student_statement: Optional[str] = None, teacher_comment: Optional[str] = None,
    ) -> ObservationEvent:
        event = super().record_event(
            student_id, raw_text, student_label, student_statement, teacher_comment
        )
        self.repo.save_event(event)   # diske yaz
        return event

    def get_events(self, student_id: str) -> list[ObservationEvent]:
        return self.repo.load_events(student_id)   # diskten oku
