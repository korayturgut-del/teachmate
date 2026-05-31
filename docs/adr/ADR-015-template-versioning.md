# ADR-015 — Şablon Versiyonlama

## Durum
Kabul Edildi — Phase 3 implement

## Bağlam
**(MANTIK-HATASI-1)** Akış `ExamCreated → QRCodeGenerated → TemplatePrinted`.
Öğretmen sınavı düzenleyince aynı sınavın 3 farklı basılı versiyonu dolaşıma girer.
AI hangi versiyona göre puanlayacağını bilemez → kaos.

## Karar
- Yeni event: `TemplateVersionCreated` (aggregate='exam')
- Her QR kodu `exam_id + version` taşır (örn: `e0001-v2`)
- Tarama sırasında QR'dan okunan versiyon, Answer Key'in versiyonuyla eşleşmezse
  `StudentMatchRejected` tetiklenir (reason: `version_mismatch`)
- `answer_keys` tablosu `template_version` kolonuyla versiyonlanır (ADR-017)
- Version hash (SHA-256) template içeriğinden hesaplanır → aynı template yanlışlıkla
  yeniden basılırsa tespit edilir

## Sonuçlar
- ✅ Aynı sınavın farklı versiyonları güvenle yönetilir
- ✅ QR kod üzerinden otomatik versiyon tespiti
- ✅ Yanlış versiyon eşleşmesi durumunda audit kaydı
- ❌ QR kod boyutu büyür (versiyon numarası eklenir — ihmal edilebilir)

## Freeze Etkisi
Yeni event_type (`TemplateVersionCreated`) — AGGREGATES seti SABİT (`exam` mevcut).

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
