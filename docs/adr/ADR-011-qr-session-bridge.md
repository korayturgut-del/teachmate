# ADR-011 — QR Oturum Köprüsü

## Durum
Önerildi — Phase 4

## Bağlam
Masaüstünde ADF tarama oturumu açılır. Aynı anda mobilde öğretmen tek kağıt okur.
İki cihazın aynı oturumda olduğunu sistem nasıl bilecek? Şu an masaüstü ve mobil
birbirinden tamamen bağımsız.

## Karar
- Tarama oturumu başladığında masaüstü ekranında **QR kod** gösterilir
- Öğretmen bu QR'ı mobil ile okutur → mobil oturumu masaüstü oturumuna bağlanır
- Aynı `session_id` paylaşılır
- Mobilde okunan kağıt, o oturumun scan listesine eklenir
- P2P sync (Phase 4) bu bağlantıyı WebRTC veri kanalıyla taşır

## Sonuçlar
- ✅ Masaüstü + mobil aynı seansta birleşir
- ✅ Öğretmen QR okutmak dışında ek işlem yapmaz
- ❌ WebRTC sinyalizasyon altyapısı gerekir (Phase 4'te Rust Agent)

## Freeze Etkisi
Yok — mevcut event'lerin metadata'sına `session_id` eklenir.

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
