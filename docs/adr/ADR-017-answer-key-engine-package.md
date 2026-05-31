# ADR-017 — Answer Key Engine Ayrı Paket

## Durum
FREEZE CHANGE REQUEST onaylandı (düşük risk) — Phase 3 implement

## Bağlam
**(Eksik tespiti)** AI grading bir cevap anahtarına göre puanlar — ama şu an cevap
anahtarı yönetimi hiçbir pakette net değil. `grading-engine` puanlama kuyruğu,
`template-engine` baskı; cevap anahtarının kendisi sahipsiz. Yeni `packages/answer-key-engine/`
paketi bu boşluğu doldurur.

## Karar
- `packages/answer-key-engine/` — yeni npm workspace paketi
- Sorumlulukları:
  - Cevap anahtarı CRUD (soru bazlı)
  - Versiyonlama (ADR-015 ile entegre)
  - Alternatif doğru cevap eşleştirme ("4" = "dört" = "IV")
  - Rubrik (açık uçlu kriterler, MEB uyumlu)
  - Kısmi puan kuralları
  - Güven eşiği değerlendirmesi (Kural 12)
- Yeni tablo: `answer_keys` — migration 002'ye eklendi
- Mevcut paket API'leri, event isimleri, tablo isimleri **değişmedi**

## Sonuçlar
- ✅ AI grading'in en kritik bağımlılığı sahiplenildi
- ✅ Versiyonlu cevap anahtarı yönetimi
- ✅ Alternatif cevap eşleştirme ile esnek puanlama
- ✅ Rubrik bazlı kısmi puan (açık uçlu sorular için)
- ❌ Yeni paket bakım yükü (kabul edilebilir — kritik işlev)

## Freeze Etkisi
⚠️ FREEZE CHANGE REQUEST. Yeni paket, yeni tablo — mevcut bileşenler etkilenmez.
Governor onayı: ✅ DÜŞÜK RİSK.

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
