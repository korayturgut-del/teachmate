-- Dijital Öğretmen Asistanı — Initial Schema (Phase 1)
-- Phase 4: SQLCipher entegrasyonu ile şifreli hale gelir.

-- Okullar
CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT,
    district TEXT,
    type TEXT DEFAULT 'devlet',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Öğretmenler
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER REFERENCES schools(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT,
    subject TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Öğrenciler
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER REFERENCES schools(id),
    school_no TEXT,
    name TEXT NOT NULL,
    class_name TEXT,
    grade_level INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sınavlar
CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER REFERENCES teachers(id),
    title TEXT,
    subject TEXT,
    exam_type TEXT DEFAULT 'yazili_1', -- yazili_1 | yazili_2 | performans | proje | diger
    class_name TEXT,
    year TEXT,
    period TEXT,
    total_questions INTEGER,
    max_score REAL,
    status TEXT DEFAULT 'beklemede', -- beklemede | isleniyor | tamamlandi | ogretmen_onayli
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

-- Sınav Sonuçları
CREATE TABLE IF NOT EXISTS exam_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id),
    student_id INTEGER REFERENCES students(id),
    total_score REAL,
    max_score REAL,
    ai_evaluation TEXT,  -- JSON
    teacher_corrections TEXT,  -- JSON
    teacher_notes TEXT,
    status TEXT DEFAULT 'ai_completed',
    version INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

-- Öğrenci Yanıtları
CREATE TABLE IF NOT EXISTS student_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    result_id INTEGER REFERENCES exam_results(id),
    question_no INTEGER,
    raw_answer TEXT,
    corrected_answer TEXT,
    ai_score REAL,
    teacher_score REAL,
    max_score REAL,
    status TEXT, -- correct | partial | wrong
    ai_explanation TEXT,
    teacher_note TEXT,
    requires_review INTEGER DEFAULT 0,
    bbox TEXT  -- JSON: sayfa koordinatları
);

PRAGMA foreign_keys = ON;
