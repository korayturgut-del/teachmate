# Dijital Öğretmen Asistanı — QA Phase 5 Final Checklist

> Phase 5 Ship — Son doğrulama kontrol listesi
> QA Agent + Governor · 2026-05-25

---

## 🔒 GÜVENLİK

- [ ] `check-credentials.sh` → 0 sonuç (hiç hardcoded secret yok)
- [ ] `.env` commit edilmemiş (`.gitignore` doğrulandı)
- [ ] SQLCipher AES-256 anahtar yönetimi: `crypto.rs` → `init_cipher`, `verify_cipher`, `rotate_key`
- [ ] PII asla cloud'a gitmez — Cloud Brain yalnızca anonim içerik
- [ ] `SECRET_KEY` varsayılan `"change-me-in-production"` değil (üretimde)

## 🏷 MARKA

- [ ] `grep -r "MAARIF OS" apps/ packages/` → 0 sonuç
- [ ] `grep -r "Kelebek" apps/ packages/` → 0 sonuç (kodda; ürün adı olarak kalabilir)
- [ ] `grep -r "teacher-app" apps/ packages/` → 0 sonuç
- [ ] Tüm UI'da "Dijital Öğretmen Asistanı" / "DÖA"
- [ ] `apps/desktop/package.json`: `"name": "dijital-ogretmen-asistani"`
- [ ] `apps/cloud-brain/main.py`: `APP_NAME` = `"Dijital Öğretmen Asistanı"`

## 🖥 BACKEND

- [ ] `GET /api/health` → `{"status":"ok","mock":false}` (DeepSeek API key varsa)
- [ ] 6 route (exam, student, school, health, archive, review) → gerçek CRUD
- [ ] Phase 3: `grading`, `ocr`, `routing` router'ları → aktif
- [ ] Event Store 20+ event tipini kaydediyor
- [ ] `requirements.txt`: asyncpg/redis/celery/jose/otel yok
- [ ] `settings.py`: saf pydantic-settings, `os.getenv()` yok

## 🦀 RUST (NATIVE)

- [ ] Tauri 2.x: `emit()` API (v1 `emit_all` yok)
- [ ] `scanner.rs`: `use tauri::Emitter;`
- [ ] `crypto.rs`: `init_cipher` `#[tauri::command]` taşımıyor
- [ ] `Cargo.toml`: `chrono = "0.4"` mevcut
- [ ] `native/` crate'leri kaldırıldı (ADR-019)
- [ ] `tauri.conf.json`: `$schema` → `"https://schema.tauri.app/config/2"`
- [ ] Kural 13 öz-denetimi yapıldı

## 📱 MOBİL

- [ ] 3 dokunuş akışı: Çek → Onayla → Kaydet (ADR-007)
- [ ] `CameraCapture.tsx` → `QuickReview.tsx` → `Archive.tsx`
- [ ] ADF toplu işlem mobilde yok
- [ ] Çevrimdışı mod yapısı mevcut

## 📊 OLAY / VERİ

- [ ] 3 migration dosyası (001, 002, 003)
- [ ] `answer_keys` tablosu migration 002'de (ADR-017)
- [ ] Decision Engine event'leri katalogda (ADR-018)
- [ ] Template versioning event'leri (ADR-015)
- [ ] StudentMatchRejected event'i (Phase 2.5)
- [ ] PII uyarı banner'ı KALDIRILDI (SQLCipher aktif — Phase 4)

## 🏛 YAPISAL

- [ ] 11 ADR belgesi imzalandı (001-019 arası, eksik numaralar kasıtlı)
- [ ] Architecture Freeze ihlali yok (tüm değişiklikler FREEZE CHANGE REQUEST ile)
- [ ] `README.md`: "Dijital Öğretmen Asistanı v1.0 — DÖA"
- [ ] `turbo.json` pipeline tanımlı
- [ ] GitHub Actions CI/CD workflow

## 📦 PAKETLEME

- [ ] `tools/build-exe.sh` → derleme script'i
- [ ] `tools/deploy-cloud.sh` → deploy script'i
- [ ] `tools/check-credentials.sh` → credential tarama
- [ ] `apps/cloud-brain/Dockerfile` → Docker imajı

---

## ⚠️ Phase 5 ENGEL Analizi (Phase 0 G6)

| Engel | Durum |
|-------|-------|
| Tauri 2.x bundler (Rust toolchain) | ✅ Cargo.toml + src-tauri/ hazır |
| Windows EXE code-signing | ⚠️ Authenticode sertifikası gerekli (harici) |
| macOS DMG notarized | ⚠️ Apple Developer hesabı gerekli (harici) |
| FastAPI Docker deployment | ✅ Dockerfile + deploy-cloud.sh |
| CI/CD (GitHub Actions) | ✅ `.github/workflows/release.yml` |
| Cloud Brain hosting (fly.io) | ⚠️ Hesap + API token gerekli (harici) |

> ⚠️ İşaretli maddeler **harici servis/hizmet** gerektirir — kod tarafında engel yok.
