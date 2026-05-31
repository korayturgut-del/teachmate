# ADR-016 — Öğretmen Karar Profili (Adaptif Kalibrasyon)

## Durum
Önerildi — Phase 3 veri toplama, Phase 5 kalibrasyon

## Bağlam
**(Stratejik)** Sistem `AI → Öğretmen → Sonuç` değil, `AI → Öğretmen Düzeltmesi → Profil → Sonraki Sınavlar`
döngüsü olmalı. Event Store zaten her `GradeOverridden` event'ini saklıyor.
Öğretmen "AI 7 verdi, ben 8 yaptım" dediğinde bu zaten loglanıyor.
**Veri zaten orada — sadece okunmuyor.**

## Karar
1. **Phase 3:** `GradeOverridden` event'leri toplanmaya başlar
2. **Phase 5:** `performance-engine` öğretmen profilini hesaplar:
   - `avg_delta`: Öğretmen AI puanına ortalama ne kadar ekliyor/çıkarıyor?
   - `rounds_to`: Hangi değere yuvarlıyor? (0.5? 1? yuvarlamıyor?)
   - `strictness`: "lenient" / "neutral" / "strict"
   - `sample_size`: Kaç düzeltme üzerinden hesaplandı?
3. Profil `app_settings` tablosunda JSON olarak saklanır (anahtar: `teacher_profile:{id}`)
4. Sonraki sınavda: AI ham puanı + öğretmen profili = kalibre edilmiş öneri

## Sonuçlar
- ✅ Sistem öğretmene uyum sağlar — "senin gibi puanlar"
- ✅ Yeni altyapı gerekmez — mevcut event'leri okur
- ✅ Tamamen yerel — profil verisi cloud'a gitmez
- ✅ Rekabet avantajı: rakipler "AI ne dediyse o", DÖA "sen nasıl puanlarsan o"
- ❌ Yeterli veri toplanana kadar (ilk ~20 sınav) profil güvenilir değil

## Freeze Etkisi
Yok — mevcut event'leri okur, `app_settings` tablosunu kullanır.

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
