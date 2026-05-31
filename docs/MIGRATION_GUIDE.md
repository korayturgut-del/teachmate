# Dijital Öğretmen Asistanı — Migration Kılavuzu

> Kaynak A/B/C → Monorepo taşıma rehberi

---

## Genel Strateji

Üç bağımsız kaynaktan tek monorepoya **kademeli, kayıpsız** taşıma.
Her fazın migration sorumlusu kendi alanındaki taşımayı yapar.

---

## Kaynak A → packages/editor-engine/ (Kelebek Editörü)

| Kaynak Konum | Hedef Konum | Sorumlu | Faz |
|-------------|------------|---------|-----|
| Fabric.js canvas (`fe*` fonksiyonları) | `packages/editor-engine/src/` | UI Agent | 2-3 |
| Z-Kitap PDF crop (`zk*` fonksiyonları) | `packages/editor-engine/src/` | UI Agent | 3 |
| Baskı motoru (`buildPage`, `doPrint`) | `packages/template-engine/` | UI Agent | 3 |
| MEB performans (`perf*` fonksiyonları) | `packages/performance-engine/` | AI Agent | 3 |
| Matematik editörü | `packages/editor-engine/src/` | UI Agent | 3 |
| Cloud block (Gist/Drive) | **SİLİNDİ** | Migration Agent | 1 |

---

## Kaynak B → packages/digital-desk/ (Dijital Masa)

| Kaynak Konum | Hedef Konum | Sorumlu | Faz |
|-------------|------------|---------|-----|
| OCR pipeline (`processPaper`) | `packages/digital-desk/src/` | Migration Agent | 2-3 |
| Görüntü işleme (`autoContrast`, `denoise3x3`) | `packages/ocr-engine/` | AI Agent | 3 |
| Kamera (`startCamera`, `captureFrame`) | `apps/mobile/src/` | UI Agent | 2 |
| IndexedDB şeması | `database/migrations/002` | Migration Agent | 2 |
| Fotoğraf arşivi (`photoStore`) | `packages/storage-engine/` | Migration Agent | 4 |
| Gemini API çağrıları | **SİLİNDİ → mock_ai.py** | Migration Agent | 1 |

---

## Kaynak C → apps/ (maarif-os)

| Kaynak Konum | Hedef Konum | Sorumlu | Faz |
|-------------|------------|---------|-----|
| `frontend/src/App.tsx` | `apps/desktop/src/App.tsx` | UI Agent | 1-2 |
| `DigitalDesk` (Konva.js) | `apps/desktop/src/components/desk/` | UI Agent | 2 |
| `ArchiveBrowser` | `apps/desktop/src/components/exam/` | UI Agent | 2 |
| `camera-utils.ts`, `pdf-utils.ts` | `apps/desktop/src/lib/` | UI Agent | 1 |
| `simulatePipeline` Mock AI | `cloud-brain/services/mock_ai.py` | AI Agent | 1 |
| FastAPI backend iskeleti | `apps/cloud-brain/` | AI Agent | 1-2 |
| SQLAlchemy modelleri | `database/schema.sql` | Architect Agent | 1 |

---

## Marka Değişiklikleri

| Eski | Yeni |
|------|------|
| `MAARIF OS` | `Dijital Öğretmen Asistanı` |
| `teacher-app` | `dijital-ogretmen-asistani` |
| `Kelebek` (kod içinde) | `EditorEngine` / `Kelebek Editörü` (ürün adı olarak kalabilir) |
| `MaarifDB` | `doa_local.db` |
| `v1.7.2` / `v3.0` | `v1.0.0-doa` |

---

## Dependency Migration

| Kaldırılan | Eklenen | Faz |
|-----------|---------|-----|
| `asyncpg` | `aiosqlite` | 1 |
| `redis` + `celery` | Yok (yerel kuyruk) | 1 |
| `opentelemetry-*` (4) | `logging` (yerel) | 1 |
| `python-jose` + `passlib` | Yok (yerel auth) | 1 |
| CDN: Fabric.js | `npm: fabric` | 2 |
| CDN: PDF.js | `npm: pdfjs-dist` | 2 |
| CDN: Google Fonts | Self-hosted | 2 |
| Gemini API | `mock_ai.py` → `deepseek.py` | 1 → 3 |
