# 🦋 Dijital Öğretmen Asistanı

Öğretmenler için tek platformda toplanmış eğitim araçları paketi. Tüm modüller ortak tasarım sistemi, ortak marka kimliği ve **tek kaynaklı bulut öğrenci listesi** ile çalışır.

## Modüller

| Modül | Klasör | Açıklama |
|-------|--------|----------|
| Öğrenci & Sınıf Listeleri | `ogrenciler/` | Sınıf oluşturma, öğrenci ekleme/silme, bulut senkronizasyonu |
| Sınav Editörü | `sinav-editoru/` | Soru/sınav grubu, çoktan seçmeli/açık uçlu/boşluk doldurma |
| Çalışma Kağıdı | `calisma-kagidi/` | Alıştırma kağıdı, soru bankası, yazdırma |
| Kelebek Dağıtım | `kelebek-dagitim/` | Salon/sıra dağıtımı, oturma planı |
| Maarif Performans | `maarif-performans/` | Maarif Modeli performans değerlendirme, raporlama |
| Dijital Test Maker | `dijital-test-maker/` | Online test, QR kod paylaşımı |
| Z-Kitap | `zkitap/` | İnteraktif kitap görüntüleme, çizim araçları |
| PDF Editörü | `pdf-editoru/` | PDF birleştirme, sayfa çıkarma, döndürme |

## Marka Kimliği

- **İsim:** Dijital Öğretmen Asistanı
- **Renk paleti:** Teal-mavi ekseni (güven + profesyonellik + akışkanlık)
  - Ana renk (teal): #0E7C86 (gündüz) / #14B8A6 (gece)
  - İkincil (mavi): #1E6FB8 (gündüz) / #38A8D8 (gece)
- **Tema:** Gece ve gündüz modu — ikisi de aynı marka hissini taşır
- Tüm renk/buton/yazı tipi tanımları shared/css/design-system.css içinde tek noktadan yönetilir.

## Bulut Dosya Sistemi (Google Drive)

Öğrenci listeleri, sınavlar ve çalışma kağıtları SADECE Google Drive üzerinden paylaşılır. Üç ayrı dosya türü vardır — her modül kendi türünü otomatik tarar, kimse Drive'da dosya aramak zorunda kalmaz:

| Tür | Uzantı | Dosya adı deseni |
|-----|--------|------------------|
| Öğrenci listesi | .ogr | Ogrenci_Listesi_1.ogr, _2, _3 … |
| Sınav / yazılı | .snv | Sinav_1.snv, _2 … |
| Çalışma kağıdı | .clk | Calisma_Kagidi_1.clk, _2 … |

Her kayıt otomatik artan numara alır — eskinin üzerine yazılmaz, karışmaz. Ortak çekirdek: shared/js/student-cloud.js

## Ortak Altyapı (shared/)

- css/design-system.css — renk değişkenleri, gece/gündüz tema
- css/layout.css, css/components.css — ortak yerleşim ve bileşenler
- js/auth-globals.js — Google giriş + Drive token (tüm modüllerin ortak çekirdeği)
- js/student-cloud.js — bulut dosya sistemi (.ogr/.snv/.clk)
- js/sync.js — yerel veritabanı (db) ve yedekleme
- js/app-core.js — ortak db durumu ve yardımcılar
- js/utils.js — dosya kodlama, toast bildirimleri, formatDate

## Kullanım

Her modül bağımsız çalışabilir. Başlamak için index.html (ana hub) açılır, oradan modüllere geçilir. Google ile giriş yapıldığında öğrenci listeleri buluttan çekilebilir.

---
Sürüm 2 · Dijital Öğretmen Asistanı © 2026
