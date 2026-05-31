# ADR-010 — Mock/Gerçek AI Rozeti

## Durum
Önerildi — Phase 3

## Bağlam
Mock AI Phase 1-2'de tüm puanlar `[MOCK]` ön ekiyle gelir. Phase 3'te DeepSeek
gerçek puanlama başlar. Ama geçiş sırasında hangi sonucun mock hangisinin gerçek
olduğu karışabilir. Özellikle kademeli geçişte (önce matematik, sonra fizik...).

## Karar
- Tüm AI yanıtlarında `provider: "mock" | "deepseek"` alanı bulunur
- UI'da her sonuç kartında **renkli rozet** gösterilir:
  - 🟡 "Mock AI — Test Amaçlı" (Phase 1-2)
  - 🟢 "DeepSeek V4 — Üretim" (Phase 3+)
- Rozet Event Store'a da yazılır (`metadata.provider`)
- Mock rozetli sonuçlar karne/PDF çıktısında "DENEME" watermark'ı alır

## Sonuçlar
- ✅ Hangi AI'ın puanladığı her zaman bilinir
- ✅ Mock verilerin gerçek karneye karışması imkansız
- ❌ UI'da ek bir görsel eleman (kabul edilebilir)

## Freeze Etkisi
Yok — metadata'ya yeni alan, yeni tablo/event yok.

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
