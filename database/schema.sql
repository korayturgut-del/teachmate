-- Dijital Öğretmen Asistanı — Tam Veritabanı Şeması (FROZEN)
-- Bu dosya tüm migration'ların birleştirilmiş halidir.
-- Değişiklik için: FREEZE CHANGE REQUEST → ADR → migration dosyası

.read migrations/001_initial_schema.sql
.read migrations/003_event_store.sql
.read migrations/002_from_indexeddb.sql
