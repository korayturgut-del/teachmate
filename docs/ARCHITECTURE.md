# Dijital Öğretmen Asistanı — Mimari Dokümantasyon

> C4 Diyagramları · Teknoloji Kararları · Dağıtım Mimarisi

---

## C4 — Level 1: Sistem Bağlam Diyagramı

```
┌──────────────────────────────────────────────────────┐
│                   ÖĞRETMEN                           │
│  Masaüstü (ADF tarama + editör)   Mobil (tek kağıt)  │
└──────────┬─────────────────────────────┬─────────────┘
           │                             │
     ┌─────▼──────┐              ┌──────▼──────┐
     │  Desktop   │              │   Mobile    │
     │  Tauri 2.x │◄──P2P E2EE──►│  React Ntv  │
     │  React/TS  │   sync       │  Expo       │
     └─────┬──────┘              └──────┬──────┘
           │                             │
           │       HTTPS (gRPC?)         │
           └──────────┬──────────────────┘
                      │
              ┌───────▼────────┐
              │  Cloud Brain   │
              │  FastAPI        │
              │  DeepSeek/OCR   │
              └────────────────┘
```

## C4 — Level 2: Konteyner Diyagramı

```
apps/desktop (Tauri 2.x)
├── src-tauri/          Rust native komutlar
│   ├── scanner.rs      ADF tarayıcı sürücüsü
│   ├── pdf.rs          PDF sayfa ayırma (native)
│   ├── qr.rs           QR/DataMatrix tespit
│   └── crypto.rs       SQLCipher AES-256 anahtar yönetimi
└── src/                React/Vite/TypeScript
    ├── pages/          Route bazlı lazy sayfalar
    │   ├── EditorPage  Fabric.js (lazy)
    │   ├── DeskPage    Konva.js (lazy)
    │   └── ArchivePage Event Store viewer
    └── components/     Ortak bileşenler

apps/mobile (React Native)
└── src/screens/
    ├── CameraCapture   1. dokunuş: fotoğraf çek
    ├── QuickReview     2-3. dokunuş: AI sonuç + onay
    └── Archive          Salt-okuma arşiv

apps/cloud-brain (FastAPI)
├── routers/            API endpoint'ler
│   ├── exam.py         Sınav CRUD + sonuçlar
│   ├── student.py      Öğrenci CRUD
│   ├── grading.py      [Phase 3] DeepSeek puanlama
│   ├── ocr.py          [Phase 3] PaddleOCR servis
│   └── routing.py      [Phase 3] Model seçici
├── services/
│   ├── mock_ai.py      [Phase 1-2] Simülasyon
│   ├── deepseek.py     [Phase 3+] Gerçek AI
│   └── paddleocr.py    [Phase 3+] Gerçek OCR
└── core/
    ├── config/         Pydantic settings (.env)
    └── database.py     SQLAlchemy async (SQLite)

packages/ (npm workspace)
├── event-bus/          Python Event Bus + Event Store
├── editor-engine/      Fabric.js React wrapper
├── answer-key-engine/  Cevap anahtarı + rubrik (Phase 2.5)
├── grading-engine/     AI puanlama kuyruğu (Phase 3)
├── ocr-engine/         Tesseract WASM → PaddleOCR (Phase 3)
├── performance-engine/ MEB 10 kriter hesaplama
├── template-engine/    Kelebek baskı motoru
├── workflow-engine/    ADF + AI + OCR orkestrasyon
├── sync-engine/        P2P E2EE senkronizasyon (Phase 4)
├── storage-engine/     SQLCipher sarmalayıcı (Phase 4)
├── auth-engine/        Yerel rol tabanlı auth (Phase 4)
└── digital-desk/       OCR pipeline + Worker kuyruğu

native/ (Rust)
├── pdf-engine-rust/    PDF sayfa render (Phase 4)
├── qr-engine-rust/     QR oluşturma/okuma (Phase 4)
└── scanner-engine-rust/ ADF sürücü bağlayıcı (Phase 4)
```

## Veri Akışı

```
ADF Tarama (Masaüstü):
  Kağıt → Scanner → PageScanned → QRDetected → StudentMatched
  → QuestionCropped → ImageEnhanced → OCRCompleted
  → AIGradingQueued → AIGradingCompleted
  → TeacherReviewStarted → GradeFinalized

Mobil Tek Kağıt:
  Kamera → MobileCaptureStarted → PhotoTaken → ImageValidated
  → QuickOCRCompleted → AIGradingSuggested → TeacherConfirmed
```

## Teknoloji Yığını

| Katman | Faz 1-2 | Faz 3 | Faz 4-5 |
|--------|---------|-------|---------|
| Desktop Shell | — | — | Tauri 2.x |
| Frontend | React 18 + Vite | — | — |
| Canvas | Fabric.js + Konva.js (route izole) | — | — |
| Mobile | — | React Native/Expo | — |
| AI | Mock AI | DeepSeek V4 | DeepSeek + TinyLLM (offline) |
| OCR | Tesseract WASM | PaddleOCR ONNX | — |
| Database | JSON file bridge | SQLite | SQLCipher AES-256 |
| Events | Event Bus + Event Store (SQLite) | — | — |
| Sync | — | — | P2P E2EE (WebRTC) |
