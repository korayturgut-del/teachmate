-- Dijital Öğretmen Asistanı — IndexedDB → SQLite Migration (Phase 2)
-- Kaynak B (index__82__.html) IndexedDB yapısından SQLite'a dönüşüm.
-- Phase 2'de Migration Agent tarafından doldurulacak.

-- Bu migration IndexedDB'deki şu store'ları taşır:
--   examCache    → exams + student_answers
--   pendingQueue → exam_results (status='beklemede')
--   PhotoStore   → student_photos (yeni tablo)

-- Öğrenci fotoğrafları (IndexedDB PhotoStore → SQLite)
CREATE TABLE IF NOT EXISTS student_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_key TEXT,  -- IndexedDB composite key (ad+no+sınıf)
    photo_data_url TEXT,  -- Base64 JPEG (Phase 4'te SQLCipher ile şifrelenir)
    exam_type TEXT,  -- 'key' | 'student'
    evaluation_json TEXT,  -- AI sonucu JSON
    captured_at TEXT NOT NULL,
    archived INTEGER DEFAULT 0,
    season TEXT
);

-- Dönem bilgisi (IndexedDB Settings → SQLite)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Migration log (hata takibi için)
CREATE TABLE IF NOT EXISTS migration_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT NOT NULL,
    status TEXT NOT NULL,  -- 'started' | 'completed' | 'failed'
    records_migrated INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Phase 2.5: Cevap Anahtarı (answer-key-engine, ADR-017)
-- FREEZE CHANGE REQUEST onaylı — yeni tablo, mevcut tabloları bozmaz.
CREATE TABLE IF NOT EXISTS answer_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id TEXT NOT NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    question_no INTEGER NOT NULL,
    max_score REAL NOT NULL,
    correct_answer TEXT,
    alternatives TEXT,  -- JSON: ["dört","4","IV"]
    rubric_json TEXT,    -- JSON: açık uçlu kriterler
    partial_credit_rules TEXT,  -- JSON: kısmi puan mantığı
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ak_exam ON answer_keys(exam_id, template_version);
