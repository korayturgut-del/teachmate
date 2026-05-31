# ADR-009 — Event Store Geri-Al (Rollback) Mekanizması

## Durum
Önerildi — Phase 3

## Bağlam
Event Store immutable — her event kalıcı. Ancak yanlışlıkla girilen bir puan (örneğin
öğretmen yanlış öğrenciye 100 verdi) sistemden silinemezse veri bütünlüğü bozulur.
Immutable log + compensating transaction pattern'i kullanılmalı.

## Karar
- Event Store'dan event **silinmez** (immutable)
- Hatalı işlem için **compensating event** yazılır: `GradeRolledBack`
- Rollback event'i orijinal event_id'yi `metadata.rollback_of` alanında referanslar
- Event Store `is_replayed` değil, `is_compensated` flag'i alır (yeni kolon değil,
  metadata içinde `compensated: true`)

## Sonuçlar
- ✅ Immutable log korunur — audit izi kaybolmaz
- ✅ Hatalı işlemler izlenebilir (kim, ne zaman, neden geri aldı)
- ❌ Event Store sorguları compensating event'leri filtrelemeyi bilmeli

## Freeze Etkisi
Yok — yeni event_type, mevcut `grade` aggregate'i. Yeni tablo/kolon yok.

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
