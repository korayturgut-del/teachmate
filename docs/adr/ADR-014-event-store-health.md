# ADR-014 — Event Store Sağlık Karnesi

## Durum
Önerildi — Phase 5

## Bağlam
Event Store büyüdükçe (100K+ event) performans sorunları başlayabilir. Eksik event,
bozuk payload veya replay zinciri kırılması sistem kararlılığını tehdit eder.
QA Agent'ın düzenli sağlık kontrolüne ihtiyacı var.

## Karar
- `packages/event-bus/src/health.py` — otomatik sağlık taraması:
  1. `event_count` — toplam event sayısı
  2. `orphan_events` — referans verdiği event silinmiş olanlar (compensating kontrolü)
  3. `payload_validity` — JSON parse edilemeyen payload'lar
  4. `chain_integrity` — ExamCreated→...→GradeFinalized zincirinde kopukluk
  5. `duplicate_events` — aynı event_id'ye sahip satırlar (olmamalı zaten, UNIQUE)
- Sağlık raporu `health.snapshot()` → JSON → QA dashboard
- Phase 5 CI/CD pipeline'ında her release öncesi otomatik çalışır

## Sonuçlar
- ✅ Proaktif sorun tespiti (kullanıcı fark etmeden)
- ✅ CI/CD'ye entegre — release güvenliği
- ❌ Büyük Event Store'larda tarama süresi (WAL modu ile optimize edilir)

## Freeze Etkisi
Yok — salt okuma sorgular, hiçbir şemayı değiştirmez.

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
