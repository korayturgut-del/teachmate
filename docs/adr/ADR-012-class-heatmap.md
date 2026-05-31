# ADR-012 — Sınıf Isı Haritası

## Durum
Önerildi — Phase 3

## Bağlam
Öğretmen tek tek sonuçları görür ama sınıfın genel durumunu anlamak için
Excel'de ayrı analiz yapar. Oysa Event Store'da tüm `GradeFinalized` event'leri
var — sınıf bazlı analiz tamamen veriden çıkarılabilir.

## Karar
- `PerformanceCalculated` event'i sınıf bazlı istatistikleri içerir:
  - Soru bazlı doğru/yanlış dağılımı
  - En çok yanlış yapılan ilk 3 soru
  - Konu bazlı başarı oranı (sorular etiketlenirse)
- UI'da "Sınıf Isı Haritası" sekmesi — yeşil=kolay, kırmızı=zor
- Öğretmen hangi konuyu tekrar anlatması gerektiğini görür

## Sonuçlar
- ✅ Veri zaten Event Store'da — sadece sorgu + görselleştirme
- ✅ Öğretmenin iş yükü azalır (Excel analizi kalmaz)
- ❌ Soruların konu bazlı etiketlenmesi gerekir (Kelebek Editörü'ne entegre)

## Freeze Etkisi
Yok — mevcut event'in payload'ı genişler (geriye dönük uyumlu).

## Tarih ve İmza
Governor Agent · Phase 2.5 · 2026-05-25
