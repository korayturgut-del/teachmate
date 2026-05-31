# ADR-018 — Decision Engine (Kademeli Zekâ Yönlendirme)

## Durum
FREEZE CHANGE REQUEST onaylandı (koşullu) — Phase 3 iskelet + Phase 4 platform OCR

## Bağlam
**(ChatGPT yapısal eleştirisi)** v6 anayasası AI'ı bir anahtar olarak modelliyor: Phase 1-2 "mock kapalı",
Phase 3 "DeepSeek açık". Gerçek bir öğretmen aracında bu yetersiz:

| Durum | v6 davranışı | Olması gereken |
|-------|-------------|----------------|
| Kapalı uçlu soru, %98 OCR güveni | DeepSeek'e gider | Yerelde çözülür, AI gereksiz |
| Fizik diyagramı | DeepSeek'e gider | Doğru — buluta yükseltilmeli |
| İnternet kesik | Sistem bekler | Yerel kademe devreye girer |

Sistemin gerçek beyni DeepSeek değil — ne zaman DeepSeek'e gidileceğine
karar veren mekanizma olmalıdır. v6 zaten "veri yerelde, akıl hibrit" diyordu;
ADR-013 zaten "önce yerel TinyLLM" diyordu. Decision Engine bu dağınık
sinyalleri tek bir resmi karar mekanizmasında toplar.

## Karar

### Escalation Akışı
```
KADEME 0 — OCR (her zaman yerel)
  PDF/Foto → QR → Öğrenci Eşleştirme → Yerel OCR → Güven Skoru

KADEME 1 — DECISION ENGINE (3 sinyal değerlendirir)
  ├── OCR confidence
  ├── Soru türü (kapalı/açık uçlu)
  └── Öğretmen profili (ADR-016)

KARAR:
  ├── YEREL → answer-key-engine doğrudan eşleştirme
  ├── BULUT → Cloud Brain DeepSeek
  └── OFFLINE → ADR-013 kuyruk
```

### Karar Tablosu (Phase 3 — 3 sinyal)

| OCR Güveni | Soru Türü | Karar | AI Çağrısı |
|:----------:|-----------|-------|:----------:|
| ≥ %95 | Kapalı uçlu | Yerel | ❌ |
| ≥ %95 | Açık uçlu | Bulut | ✅ DeepSeek |
| %80–%95 | Kapalı uçlu | Yerel + onay | ❌ |
| %80–%95 | Açık uçlu | Bulut | ✅ DeepSeek |
| < %80 | Herhangi | Bulut + zorunlu onay | ✅ DeepSeek |
| Herhangi | İnternet yok | Offline kuyruk | ⏳ |

### Yeni Event'ler (Freeze güvenli)
- `GradingRoutedLocal` (aggregate='grade') — yerel çözüldü
- `GradingEscalatedCloud` (aggregate='grade') — buluta yükseltildi

### Yeni Paket
`packages/decision-engine/` — `grading-engine`'in içinden çağrılır,
dış dünyaya sızmaz. `grading-engine` public API'si korunur.

## Sonuçlar

- ✅ AI çağrılarının ~%50-70'i yerelde → DeepSeek maliyeti düşer
- ✅ Yerel çözülen kağıt buluta gitmez → KVKK uyumu otomatik
- ✅ İnternet kesik → sistem durmaz (yerel + kuyruk)
- ✅ Kapalı uçlu sorular ms içinde → öğretmen beklemez
- ❌ Decision Engine kararları yanlışsa yanlış kademede puanlama (Phase 5'te 5 sinyale genişletilir)

## Freeze Etkisi
⚠️ FREEZE CHANGE REQUEST. Yeni paket + `grading-engine` iç davranış değişikliği.
Koşul: `grading-engine` PUBLIC API'si değişmez. Decision Engine içeride çağrılır.
Mevcut event/tablo/monorepo yapısı değişmez.

## Tarih ve İmza
Governor Agent · Phase 3 · 2026-05-25
