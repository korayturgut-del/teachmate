# 🎓 Dijital Öğretmen Asistanı — Kullanıcı Kılavuzu
### v1.15 · Mayıs 2026

---

## 🚀 Hızlı Başlangıç (3 Adım)

### 1. Kurulum
```bash
# Windows
DijitalOgretmenAsistani_1.15.0_x64-setup.exe

# macOS
DijitalOgretmenAsistani_1.15.0_x64.dmg

# Linux
DijitalOgretmenAsistani_1.15.0_amd64.AppImage
```

### 2. İlk Çalıştırma
Uygulama açıldığında **kurulum sihirbazı** (OnboardingWizard) görünür:
- Ad Soyad ve okul bilgilerinizi girin
- Branşınızı seçin
- Otomatik onay eşiğini ayarlayın (varsayılan: %85)

### 3. İlk Sınavı Okuyun
1. Ana ekranda **"PDF veya Fotoğraf Yükle"** butonuna tıklayın
2. Sınav kağıdını seçin (PDF, JPG, PNG)
3. Sistem otomatik olarak okuyup değerlendirir
4. **Dijital Masa**'da sonuçları inceleyin

---

## 📱 Mobil Uygulama (ADR-007: 3 Dokunuş)

### Sınıfta Kullanım
Öğretmen okulda telefonuyla **1-2 kağıt** okuyabilir:

**Dokunuş 1:** Kamerayı aç, kağıdı çerçevele, çek
**Dokunuş 2:** AI değerlendirmesini gör (otomatik)
**Dokunuş 3:** Onayla ve kaydet

### Masaüstüne Devret (ADR-011 QR Köprüsü)
Sınıfta okuduğunuz kağıtları eve gelince masaüstüne aktarın:
1. QuickReview ekranında **"📱→🖥 Masaüstüne Gönder"** butonuna basın
2. QR karelerini sırayla gösterin
3. Masaüstü kamerayla okutun → otomatik aktarım

---

## 🖥 Dijital Masa

### Soru Bazlı İnceleme
Her soru kutusuna tıkladığınızda sağ panelde:
- **Puan kaynağı**: 🔑 Cevap Anahtarı / 📋 Rubrik / 🤖 AI Tahmini
- **AI açıklaması**: Neden bu puan verildi
- **Rubrik detayı**: Her kriter için verilen puan
- **Güven rengi**: Yeşil (yüksek) / Sarı (orta) / Kırmızı (düşük)

### Toplu Onay (v1.10)
Özet panelinde **"✅ N soruyu toplu onayla"** butonu:
- %85'in üzerinde güvenli sorular otomatik onaylanır
- Düşük güvenli sorular inceleme listesine düşer

### Kalem ile Düzeltme (v1.10)
- Apple Pencil / stylus: gerçek basınç duyarlı çizim
- Avuç reddi (palm rejection): el masaya yaslanabilir
- Yüksek güven → kalem notları learning-engine'e gönderilir

---

## 🔑 Cevap Anahtarı ve Rubrik

### Cevap Anahtarı Yükleme (ADR-017)
Sınav oluştururken veya sonrasında:
```
Editör → Sınav Ayarları → Cevap Anahtarı Ekle
```
Her soru için:
- Doğru cevap (tek veya alternatifler: "4" = "dört" = "IV")
- Maksimum puan
- Kısmi puan kuralları
- Açık uçlu için rubrik kriterleri

### Puanlama Zinciri (Madde 6)
```
1. Cevap Anahtarı eşleşmesi → Kesin puan (AI çağrılmaz, ücretsiz)
2. Rubrik kriteri → Kısmi puan (AI çağrılmaz, ücretsiz)
3. AI değerlendirme → Son çare (DeepSeek veya Gemini Vision)
4. Öğretmen onayı → Kesin sonuç
```

---

## 🔒 Veri Güvenliği ve KVKK

### Neler Cihazda Kalır?
| Veri | Konum |
|------|-------|
| Öğrenci adı, numarası | ✅ Yerel SQLCipher AES-256 |
| Sınav notları | ✅ Yerel SQLCipher AES-256 |
| Fotoğraf/tarama | ✅ Yerel depolama |

### Neler Buluta Gider?
| Veri | Koşul |
|------|-------|
| Anonim soru metni | AI puanlama gerektiğinde |
| OCR düzeltmesi | `consent_to_train=True` ve izin verildiğinde |
| **Öğrenci kimliği** | ❌ **Hiçbir zaman** |

### KVKK Haklarınız
Ayarlar → Gizlilik → **"Verilerimi Sil"** ile tüm cloud kayıtlarınız silinir.
KVKK Madde 13 kapsamında silme talebi anında işlenir.

---

## 🤖 AI Motoru Seçimi

### Otomatik Mod (Önerilen)
```
AI_PROVIDER=auto
```
- Basılı, yüksek güven → **Yerel** (ücretsiz)
- Matematik / diyagram → **Gemini Vision**
- Metin / anlamsal → **DeepSeek**
- İnternet yok → **Offline kuyruk**

### OCR Teknolojisi (Platform Bazında)
| Platform | Motor | Kaynak |
|----------|-------|--------|
| Android | ML Kit Document Scanner v2 | Google |
| iOS | Apple Vision Framework | Apple |
| Masaüstü | PaddleOCR PP-OCRv4 ONNX | Açık kaynak |
| Formüller | Mathpix Convert API | Bulut |
| Türkçe düzeltme | Zemberek NLP | Açık kaynak |

> **Gemini Araştırması (Mayıs 2026):** Zemberek + NLP morfoloji düzeltme,
> Türkçe OCR çıktısında %92 doğruluğa ulaşmaktadır.

---

## 📊 Performans İpuçları

### Yüksek Doğruluk İçin
1. **Kağıt kalitesi**: Kareli/çizgili kağıt arka planı OCR'ı zorlaştırır
   - Gemini araştırması: arka plan çizgileri asgari düzeyde tutulmalı
2. **Işık**: Düzgün, gölgesiz aydınlatma
3. **Açı**: Kağıdı tam düz tutun (Deskew otomatik uygulanır)
4. **Çözünürlük**: Minimum 300 DPI (ADF tarayıcı önerilen)

### Formül Tanıma
Matematiksel formüller için:
- Masaüstü dijital masa: `stroke verisi` → Mathpix v3/strokes
  (kağıt taramasından daha doğru — vuruş sırası bilgisi kullanılır)
- Fotoğraf: PaddleOCR → Mathpix Convert API → LaTeX

---

## 🔄 Otomatik Güncelleme

Uygulama başlatıldığında güncelleme kontrolü yapar.
Yeni sürüm varsa bildirim gösterilir.

Manuel kontrol:
```
Ayarlar → Hakkında → Güncellemeleri Kontrol Et
```

---

## 📞 Destek

- **Kılavuz**: https://docs.doa.ai
- **KVKK**: kvkk@doa.ai
- **Teknik**: support@doa.ai

---

*Dijital Öğretmen Asistanı v1.15 · DÖA · Mayıs 2026*
*KVKK (6698 sayılı Kanun) uyumlu · Veriler Türkiye'de*
