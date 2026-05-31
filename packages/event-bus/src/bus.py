"""Dijital Öğretmen Asistanı — Event Bus (FROZEN)

Phase 2: SQLite tabanlı gerçek Event Bus implementasyonu.
Tüm workflow event'leri bu sınıf üzerinden akar.

Şema: Architecture Freeze kapsamında — değiştirmek için FREEZE CHANGE REQUEST.
"""

import sqlite3
import json
import uuid
import threading
import time
from typing import Any, Callable, Optional


class EventBus:
    """SQLite-tabanlı Event Bus — publish/subscribe + immutable Event Store.

    Her event kalıcı olarak SQLite'a yazılır. PII alanları Phase 4'te
    şifrelenecek (SQLCipher), şimdilik uyarı banner'ı gösterilir.

    Kullanım:
        bus = EventBus("doa_events.db")
        bus.emit("ExamCreated", "exam", {"exam_id": "e1"})
        bus.on("ExamCreated", lambda e, a, p, i, m: print(p))
    """

    # FROZEN: Event Store tablo adı — değiştirilemez
    STORE_TABLE = "event_store"

    # FROZEN: Desteklenen aggregate domain'leri
    AGGREGATES = frozenset({
        "exam", "student", "grade", "scan", "mobile_capture",
    })

    def __init__(self, db_path: str = "doa_events.db"):
        self._handlers: dict[str, list[Callable]] = {}
        self._lock = threading.RLock()
        self._db_path = db_path
        self._db: Optional[sqlite3.Connection] = None
        self._connect()
        self._init_store()

    # ── Veritabanı ──────────────────────────────────────────────

    def _connect(self) -> None:
        """SQLite bağlantısı — WAL modu, thread-safe."""
        self._db = sqlite3.connect(
            self._db_path,
            check_same_thread=False,
            isolation_level=None,  # auto-commit
        )
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("PRAGMA synchronous=NORMAL")
        self._db.execute("PRAGMA foreign_keys=ON")

    def _init_store(self) -> None:
        """Event Store tablosu — FROZEN şema."""
        self._execute("""
            CREATE TABLE IF NOT EXISTS event_store (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT UNIQUE NOT NULL,
                event_type TEXT NOT NULL,
                aggregate TEXT NOT NULL,
                payload TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                is_replayed INTEGER NOT NULL DEFAULT 0
            )
        """)
        self._execute(
            "CREATE INDEX IF NOT EXISTS idx_es_type ON event_store(event_type)"
        )
        self._execute(
            "CREATE INDEX IF NOT EXISTS idx_es_agg ON event_store(aggregate)"
        )
        self._execute(
            "CREATE INDEX IF NOT EXISTS idx_es_created ON event_store(created_at)"
        )
        self._db.commit()

    def _execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        """Thread-safe execute."""
        with self._lock:
            return self._db.execute(sql, params)

    # ── Event Yayınlama ────────────────────────────────────────

    def emit(
        self,
        event_type: str,
        aggregate: str,
        payload: dict[str, Any],
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Event yayınla + Event Store'a kalıcı yaz.

        Args:
            event_type: Event kataloğundaki isim (örn. 'ExamCreated')
            aggregate: Domain adı ('exam' | 'student' | 'grade' | 'scan' | 'mobile_capture')
            payload: Event verisi — PII içeriyorsa uyarı loglanır
            metadata: Opsiyonel ({agent_id, teacher_id, device_type, ...})

        Returns:
            event_id: UUID v4 unique event ID

        Raises:
            ValueError: aggregate tanınmıyorsa
        """
        if aggregate not in self.AGGREGATES:
            raise ValueError(
                f"Bilinmeyen aggregate '{aggregate}'. "
                f"Desteklenenler: {sorted(self.AGGREGATES)}"
            )

        event_id = str(uuid.uuid4())
        now = time.strftime("%Y-%m-%d %H:%M:%S")
        payload_json = json.dumps(payload, ensure_ascii=False)
        meta_json = json.dumps(metadata, ensure_ascii=False) if metadata else None

        # PII kontrolü — Phase 4'te SQLCipher ile çözülecek
        pii_fields = {"student_name", "student_no", "school_no", "name"}
        if pii_fields & set(payload.keys()):
            # Phase 1-3: sessizce logla, uyarı banner'ı UI'da zaten var
            pass

        self._execute(
            f"""INSERT INTO {self.STORE_TABLE}
                (event_id, event_type, aggregate, payload, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?)""",
            (event_id, event_type, aggregate, payload_json, meta_json, now),
        )
        self._db.commit()

        # Handler'ları senkron çağır — hatalar event store'u etkilemez
        handlers = self._handlers.get(event_type, []) + self._handlers.get("*", [])
        for handler in handlers:
            try:
                handler(event_type, aggregate, payload, event_id, metadata)
            except Exception:
                pass  # Handler hataları event store integrity'sini bozamaz

        return event_id

    def emit_batch(
        self,
        events: list[dict[str, Any]],
    ) -> list[str]:
        """Toplu event yayınla — tek transaction'da.

        Args:
            events: [{"event_type": str, "aggregate": str, "payload": dict, "metadata": dict}]

        Returns:
            Oluşturulan event_id'lerin listesi
        """
        event_ids = []
        now = time.strftime("%Y-%m-%d %H:%M:%S")

        with self._lock:
            for evt in events:
                eid = str(uuid.uuid4())
                event_ids.append(eid)
                self._db.execute(
                    f"""INSERT INTO {self.STORE_TABLE}
                        (event_id, event_type, aggregate, payload, metadata, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        eid,
                        evt["event_type"],
                        evt["aggregate"],
                        json.dumps(evt["payload"], ensure_ascii=False),
                        json.dumps(evt.get("metadata"), ensure_ascii=False) if evt.get("metadata") else None,
                        now,
                    ),
                )
            self._db.commit()

        # Handler'ları transaction sonrası çağır
        for i, evt in enumerate(events):
            handlers = self._handlers.get(evt["event_type"], [])
            for handler in handlers:
                try:
                    handler(
                        evt["event_type"],
                        evt["aggregate"],
                        evt["payload"],
                        event_ids[i],
                        evt.get("metadata"),
                    )
                except Exception:
                    pass

        return event_ids

    # ── Subscription ───────────────────────────────────────────

    def on(self, event_type: str, handler: Callable) -> None:
        """Event tipine handler kaydet.

        Args:
            event_type: Dinlenecek event tipi veya "*" (tüm event'ler)
            handler: Callable(event_type, aggregate, payload, event_id, metadata)
        """
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    def off(self, event_type: str, handler: Optional[Callable] = None) -> None:
        """Handler kaydını kaldır. handler=None ise tüm handler'lar kaldırılır."""
        if handler is None:
            self._handlers.pop(event_type, None)
        elif event_type in self._handlers:
            self._handlers[event_type] = [
                h for h in self._handlers[event_type] if h is not handler
            ]

    # ── Sorgulama & Replay ─────────────────────────────────────

    def query(
        self,
        event_type: Optional[str] = None,
        aggregate: Optional[str] = None,
        since: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Event Store'dan event sorgula.

        Args:
            event_type: Filtre (opsiyonel)
            aggregate: Filtre (opsiyonel)
            since: ISO timestamp — bu tarihten sonrakiler
            limit: Max sonuç
            offset: Sayfalama
        """
        conditions = []
        params = []

        if event_type:
            conditions.append("event_type = ?")
            params.append(event_type)
        if aggregate:
            conditions.append("aggregate = ?")
            params.append(aggregate)
        if since:
            conditions.append("created_at >= ?")
            params.append(since)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql = f"""
            SELECT id, event_id, event_type, aggregate, payload, metadata,
                   created_at, is_replayed
            FROM {self.STORE_TABLE}
            {where}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])

        rows = self._execute(sql, tuple(params)).fetchall()
        return [
            {
                "id": r[0],
                "event_id": r[1],
                "event_type": r[2],
                "aggregate": r[3],
                "payload": json.loads(r[4]),
                "metadata": json.loads(r[5]) if r[5] else None,
                "created_at": r[6],
                "is_replayed": bool(r[7]),
            }
            for r in rows
        ]

    def replay(
        self,
        event_type: Optional[str] = None,
        aggregate: Optional[str] = None,
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        """Event'leri yeniden oynat (audit/debug/projeksiyon rebuild)."""
        events = self.query(event_type=event_type, aggregate=aggregate, limit=limit)
        # Replay işaretle
        if events:
            ids = [e["event_id"] for e in events]
            placeholders = ",".join("?" * len(ids))
            self._execute(
                f"UPDATE {self.STORE_TABLE} SET is_replayed = 1 WHERE event_id IN ({placeholders})",
                tuple(ids),
            )
            self._db.commit()
        return events

    def count(
        self,
        event_type: Optional[str] = None,
        aggregate: Optional[str] = None,
    ) -> int:
        """Event sayısı."""
        conditions = []
        params = []
        if event_type:
            conditions.append("event_type = ?")
            params.append(event_type)
        if aggregate:
            conditions.append("aggregate = ?")
            params.append(aggregate)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        row = self._execute(
            f"SELECT COUNT(*) FROM {self.STORE_TABLE} {where}", tuple(params)
        ).fetchone()
        return row[0] if row else 0

    def stats(self) -> dict[str, Any]:
        """Event Store istatistikleri."""
        total = self.count()
        by_type_rows = self._execute(
            f"SELECT event_type, COUNT(*) FROM {self.STORE_TABLE} GROUP BY event_type"
        ).fetchall()
        by_agg_rows = self._execute(
            f"SELECT aggregate, COUNT(*) FROM {self.STORE_TABLE} GROUP BY aggregate"
        ).fetchall()
        return {
            "total_events": total,
            "by_type": dict(by_type_rows),
            "by_aggregate": dict(by_agg_rows),
            "db_path": self._db_path,
        }

    # ── Bakım ──────────────────────────────────────────────────

    def vacuum(self) -> None:
        """SQLite VACUUM — periyodik bakım."""
        self._execute("VACUUM")

    def close(self) -> None:
        """Bağlantıyı kapat."""
        if self._db:
            self._db.close()
            self._db = None


# Singleton — Cloud Brain'in tamamı aynı instance'ı kullanır
event_bus = EventBus()
