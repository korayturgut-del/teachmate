-- Dijital Öğretmen Asistanı — Event Store (FROZEN)
-- Phase 1: İskelet. Phase 2: Tüm event kataloğu bağlanır.
-- Bu şema Architecture Freeze kapsamındadır — değiştirmek için FREEZE CHANGE REQUEST gereklidir.

CREATE TABLE IF NOT EXISTS event_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    aggregate TEXT NOT NULL,  -- 'exam' | 'student' | 'grade' | 'scan' | 'mobile_capture'
    payload TEXT NOT NULL,    -- JSON blob, PII alanları şifreli (Phase 4)
    metadata TEXT,            -- {agent_id, teacher_id, session_id, device_type, app_version}
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_replayed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_es_type ON event_store(event_type);
CREATE INDEX IF NOT EXISTS idx_es_agg ON event_store(aggregate);
