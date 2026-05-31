# 🎓 Dijital Öğretmen Asistanı — DÖA

> **Yapay Zeka ile Otomatik Sınav Okuma Sistemi**
>
> Phase 1 — Scaffold & Merge

---

## 📋 Hakkında

Dijital Öğretmen Asistanı (DÖA), öğretmenlerin sınav kağıtlarını yapay zeka ile
otomatik okuyup değerlendiren masaüstü + mobil uygulamadır.

**Mimari:** "Veri Yerelde — Akıl Hibrit/Bulutta — Öğretmen Sınıfta"

## 🏗 Proje Yapısı

```
dijital-ogretmen-asistani/
├── apps/
│   ├── desktop/        # Tauri 2.x + React/Vite/TypeScript
│   ├── mobile/         # React Native (3-dokunuş akışı)
│   └── cloud-brain/    # Python FastAPI AI Gateway
├── packages/           # Paylaşılan motorlar (12 paket)
├── native/             # Rust native modüller
├── database/           # SQLite migration'ları
└── docs/               # ADR karar kayıtları
```

## 🚀 Hızlı Başlangıç

```bash
# Credential kontrolü
bash tools/check-credentials.sh

# .env oluştur
cp .env.example .env
# → .env dosyasını düzenle

# Frontend
cd apps/desktop
npm install
npm run dev

# Backend (Cloud Brain)
cd apps/cloud-brain
pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

## 🛠 Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Desktop | Tauri 2.x, React 18, Vite, TypeScript, Tailwind |
| Canvas | Fabric.js (editor), Konva.js (desk) |
| Mobile | React Native / Expo |
| Cloud Brain | Python FastAPI |
| AI | DeepSeek (Phase 3+), Mock AI (Phase 1-2) |
| OCR | PaddleOCR ONNX (Phase 3+) |
| Database | SQLite → SQLCipher AES-256 (Phase 4) |
| Events | Event Bus + Event Store (SQLite, immutable) |
| Auth | Yerel auth engine (Phase 2) |

## 📒 ADR Kararları

| ADR | Karar | Durum |
|-----|-------|-------|
| ADR-004 | Fabric.js + Konva.js route izolasyonu | ✅ |
| ADR-005 | Cloud Brain → FastAPI | ✅ |
| ADR-006 | Mock AI Phase 1-2 zorunlu | ✅ |
| ADR-007 | Mobil 3-dokunuş maksimum | ✅ |

## 📋 Faz Durumu

| Faz | Adı | Durum |
|-----|-----|-------|
| 0 | Governor Analizi | ✅ Tamamlandı |
| 1 | Scaffold & Merge | 🟡 Devam ediyor |
| 2 | Integration | ⏳ Bekliyor |
| 3 | AI & OCR | ⏳ Bekliyor |
| 4 | Native & Desktop | ⏳ Bekliyor |
| 5 | Ship | ⏳ Bekliyor |

## ⚠️ Güvenlik Notu (Phase 1-3)

SQLCipher şifreleme Phase 4'te aktif olacak. Bu süre zarfında hassas sınav
verileriyle üretim kullanımı önerilmez. Masaüstü uygulamasında kullanıcıya
uyarı banner'ı gösterilir.

## 📄 Lisans

Tüm hakları saklıdır.
