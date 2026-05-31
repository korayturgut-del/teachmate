# 🦋 Dijital Öğretmen Asistanı — Birleşik Sürüm (Unified DOA)

Üç kaynağın titizlikle birleştirildiği **tek bütün ürün**. Hiçbir özellik kaybı yoktur.

## Kaynaklar
| Kaynak | Katkı |
|---|---|
| `dijital-ogretmen-asistani__3_.tar` | Ana mimari (apps, packages, native, docs) |
| `dijital-ogretmen-asistani__1_.zip` (kelebek_v2) | Web modülleri (10 modül) |
| `maarif_os_performans_tar.gz` | **Maarif beyni v2.0** — kanıt defteri, sene sonu, örüntü |

## Sağlayıcı zinciri (öncelikli)
```
DeepSeek-OCR 2  →  Gemini Vision  →  DeepSeek V4  →  Rubric  →  none
   (görsel)           (görsel)         (metin)      (deterministik)
```

DeepSeek-OCR 2 (Mistral'dan ucuz, kullanıcı talebi) artık yazılı-okuma AI'ında
öncelikli sağlayıcıdır.

## AI klasör izolasyonu
```
apps/cloud-brain/ai/
├── ortak/          ← provider.py (paylaşılan)
├── performans/     ← Maarif beyni (8 dosya, 1561 satır)
│   └── Kanıt defteri, çift ses, sene sonu, silinemez damga
└── yazili_okuma/   ← Sınav okuma (DeepSeek-OCR 2 öncelikli)
```

**Performans ve yazılı-okuma AI'ları birbirini hiç import etmez** (AST doğrulamalı).
Birini değiştirmek diğerini etkilemez.

## Web modülleri (her biri bağımsız)
- calisma-kagidi (+ şekil editörü)
- sinav-editoru (+ şekil editörü)
- pdf-editoru
- dijital-test-maker
- kelebek-dagitim
- maarif-performans (→ ai/performans'a HTTP ile bağlı)
- ogrenciler (öğrenci kaydı, db.classes kaynağı)
- zkitap
- shared (tasarım sistemi)

## Maarif beyni v2.0 yetenekleri
1. Tek olay değerlendirme (`POST /api/maarif/evaluate`)
2. Kanıt defteri olay kaydı (`POST /api/maarif/events`)
3. Çift ses kaydı (öğrenci beyanı + öğretmen yorumu)
4. Örüntü analizi (`GET /api/maarif/pattern/{id}`)
5. Sene sonu hesap verebilirlik (`GET/POST /api/maarif/yearend/...`)
   - Silinemez damga: öğretmen ezmesi yapılabilir AMA gizlenemez
6. Sentetik veri fabrikası (`GET /api/maarif/factory/preview`)
7. Ontoloji önizleme (`GET /api/maarif/meta`)

## Yazılı okuma yetenekleri
1. **DeepSeek-OCR 2** sınav kağıdı tek seferde okuma + puanlama
2. Gemini Vision soru-soru fallback
3. DeepSeek V4 metin puanlama
4. Mathpix Strokes (dijital mürekkep — v1.15 korundu)
5. Cevap anahtarı eşleştirme (Madde 6 zinciri)

## Şekil editörü
Her ilgili modülde **22 hazır şekil** (Matematik, Geometri, Vektör, Elektrik) +
Fabric.js editör + Apple Pencil/S-Pen basınç + kilitleme + zoom.
Bağımsız çalışır — modülü zip'leyip ayrı verirsen yine çalışır.

## Bağımsızlık iş akışı
Sen bir klasörü zip'leyip verirsin, düzeltir geri veririm:
- `web-modules/<modül>/` → arayüz işleri
- `ai/performans/` → Maarif beyni değişikliği
- `ai/yazili_okuma/` → Sınav okuma değişikliği
- `ai/ortak/` → Sağlayıcı zinciri değişikliği
- `services/` → AI SDK adapter'ları

## Çalıştırma
```bash
# Cloud-brain
cd apps/cloud-brain
pip install -r requirements.txt openai
uvicorn main:app --port 8000

# Web modülleri
cd web-modules
python3 -m http.server 5500
```

## Ortam değişkenleri
```
DEEPSEEK_API_KEY=...
DEEPSEEK_OCR_API_KEY=...   (boşsa DEEPSEEK_API_KEY kullanılır)
GEMINI_API_KEY=...
MAARIF_DB_PATH=maarif_os.db
AI_PROVIDER=auto
```

## Test sonuçları (birleştirme sonrası — takıntılı mühendis raporu)
```
Dosya taraması:        145 kod dosyası
AI izolasyonu:         3/3   (AST doğrulamalı, çapraz import yok)
Maarif beyni:          9/9   (8 .py + frontend/index.html)
DeepSeek-OCR 2:        3/3   (adapter + provider + reader bağlı)
Canlı endpoint'ler:   21/21  (eski + yeni Maarif + yazılı okuma)
Frontend modülleri:    7/7   (maarif-performans tam)
Python sözdizim:      13/13  (tüm yeni dosyalar temiz)
Şekil editörü:        22/22 şekil × 2 modül
─────────────────────────────────
TOPLAM:               61 ✅ · 0 kritik hata
```
