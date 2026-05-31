# ADR-013 — Çevrimdışı AI Kuyruğu

## Durum
Önerildi — Phase 3

## Bağlam
Öğretmen okulda internet olmadan sınav okur. Cloud Brain'e ulaşılamaz.
Ama puanlamanın hemen yapılması gerekir. Mobil cihazda DeepSeek çalışmaz.

## Karar
- Mobil ve masaüstünde **çevrimdışı kuyruk**:
  1. OCR her zaman yerelde çalışır (PaddleOCR ONNX, Phase 3)
  2. AI grading için: önce **yerel TinyLLM** dener (ONNX quantized model, ~200MB)
  3. TinyLLM yetersiz kalırsa → kuyruğa alır, internete çıkınca Cloud Brain'e gönderir
- Kuyruk IndexedDB/SQLite'da `pending_ai_jobs` tablosunda
- Sync sırasında toplu gönderilir, sonuçlar event olarak geri yazılır
- Öğretmene "3 sonuç çevrimdışı kuyrukta — internete çıkınca puanlanacak" bildirimi

## Sonuçlar
- ✅ Tamamen çevrimdışı çalışma (OCR her zaman)
- ✅ AI puanlama için graceful degradation
- ❌ TinyLLM modeli cihazda ~200MB yer kaplar
- ❌ Kuyruktaki sonuçlar için gecikme olabilir

## Freeze Etkisi
Yeni tablo (`pending_ai_jobs`) — mevcut tabloları bozmaz.

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
