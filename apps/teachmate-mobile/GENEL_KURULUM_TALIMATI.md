# TEACHMATE — GENEL KURULUM TALİMATI (Yerel Ajan İçin)

> BU DOSYA BİR TALİMATTIR. ADIM ATLAMA. TAHMİN YÜRÜTME. UYDURMA.
> Her adımda BEKLENEN ÇIKTI yazılıdır. Çıktı eşleşmiyorsa DUR ve
> "HATA: <adım no> beklenen çıktı gelmedi" yaz, sonraki adıma GEÇME.
> Bir dosya yolu veya komut bu dosyada AÇIKÇA yazmıyorsa, ÇALIŞTIRMA.

---

## 0. ÖN KOŞULLAR (önce bunları doğrula)

Şu komutları SIRAYLA çalıştır. Her birinin çıktısını kontrol et.

```
node --version
```
BEKLENEN: `v18.` veya `v20.` veya daha yüksek. Düşükse DUR, Node.js 20 kur.

```
npm --version
```
BEKLENEN: `9.` veya `10.` gibi bir sürüm.

```
git --version
```
BEKLENEN: `git version 2.x`. Yoksa DUR, git kur.

Eğer herhangi biri "command not found" derse: o aracı kur, sonra bu adıma geri dön.

---

## 1. PROJE KLASÖRÜNE GİR

Teachmate mobil uygulaması şu klasördedir:
```
cd dijital-ogretmen-asistani/apps/teachmate-mobile
```
DOĞRULAMA:
```
ls
```
BEKLENEN ÇIKTI şu dosyaları İÇERMELİ (hepsi olmalı):
```
App.tsx  app.json  eas.json  package.json  tsconfig.json  babel.config.js  src
```
Bu dosyalar yoksa YANLIŞ KLASÖRDESİN. DUR. Doğru klasörü bul.

---

## 2. BAĞIMLILIKLARI KUR

```
npm install
```
BEKLENEN: Birkaç dakika sürer. Sonunda `added NNN packages` yazar.
HATA olursa (örn. peer dependency): şu komutu dene:
```
npm install --legacy-peer-deps
```
Başka hata varsa DUR ve hatayı aynen rapor et. Çözüm uydurma.

---

## 3. EXPO CLI ve EAS CLI KUR

```
npm install -g eas-cli
```
DOĞRULAMA:
```
eas --version
```
BEKLENEN: `eas-cli/x.x.x` gibi bir sürüm. "command not found" derse:
```
npx eas-cli --version
```
ile devam et (her `eas` komutunun önüne `npx` ekle).

---

## 4. ORTAM DEĞİŞKENLERİNİ AYARLA

`.env.example` dosyasını `.env` olarak kopyala:
```
cp .env.example .env
```

`.env` dosyasını aç ve şu İKİ değeri GERÇEK değerlerle değiştir:

```
EXPO_PUBLIC_API_BASE=https://KULLANICIADI-teachmate-brain.hf.space
EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

- `EXPO_PUBLIC_API_BASE`: Bölüm 8'de Hugging Face'e beyin kurulduktan
  SONRA alınacak gerçek adres. ŞİMDİLİK boş bırakma, Bölüm 8'i önce yap
  veya geçici olarak kendi bilgisayarının IP'sini yaz.
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`: Bölüm 7'de oluşturulacak.

> NOT: Bu iki değer gerçek değilse uygulama açılır ama giriş ve AI çalışmaz.
> Bu NORMALDİR. Önce 7 ve 8'i tamamla.

---

## 5. UYGULAMAYI TEST ET (APK'dan ÖNCE)

```
npx expo start
```
BEKLENEN: Terminalde bir QR kod ve `Metro waiting on exp://...` görünür.
Telefonunda **Expo Go** uygulamasını kur, QR kodu okut.
BEKLENEN: Telefonda Teachmate açılır, login ekranı görünür.

Test bitince terminalde `Ctrl+C` ile durdur.

Eğer QR okutunca hata çıkarsa: hata mesajını aynen rapor et. DUR.

---

## 6. GOOGLE OAUTH KURULUMU (giriş için ZORUNLU)

1. Tarayıcıda aç: `https://console.cloud.google.com/`
2. Üstten yeni proje oluştur: ad = `Teachmate`
3. Sol menü → "APIs & Services" → "OAuth consent screen"
   - User Type: **External** seç → CREATE
   - App name: `Teachmate`
   - User support email: kendi e-postan
   - Developer contact: kendi e-postan
   - SAVE AND CONTINUE (sonraki ekranları boş geçebilirsin)
   - "Test users" bölümüne İZİN VERECEĞİN e-postaları ekle
     (sadece bunlar giriş yapabilecek)
4. Sol menü → "Credentials" → "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: **Android**
   - Name: `Teachmate Android`
   - Package name: `tr.com.teachmate.app`  (app.json'daki ile AYNI olmalı)
   - SHA-1: Bölüm 9'da EAS build sonrası alınır. ŞİMDİLİK geçici:
     Bir kere `eas credentials` çalıştırıp Android keystore oluştur,
     oradaki SHA-1'i buraya yapıştır. (Bölüm 9'a bak.)
5. Oluşan **Client ID**'yi kopyala → `.env` dosyasındaki
   `EXPO_PUBLIC_GOOGLE_CLIENT_ID` değerine yapıştır.

> İZİN VERİLEN KULLANICILAR: Hem buradaki "Test users" listesi, hem de
> kod içindeki `src/lib/auth.ts` dosyasındaki `ALLOWLIST` dizisi.
> İkisine de izin verdiğin e-postaları ekle.

`src/lib/auth.ts` içinde şu satırı bul:
```
export const ALLOWLIST: string[] = [
  // 'ogretmen@okul.k12.tr',
];
```
İzin vereceğin e-postaları buraya yaz, örnek:
```
export const ALLOWLIST: string[] = [
  'ayse@okul.k12.tr',
  'mehmet@okul.k12.tr',
];
```

---

## 7. HUGGING FACE'E BEYNİ KUR (AI için ZORUNLU)

Beyin = `dijital-ogretmen-asistani/apps/cloud-brain` klasörü.

1. `https://huggingface.co/` adresinde ücretsiz hesap aç.
2. Sağ üst → New → **Space**
   - Space name: `teachmate-brain`
   - License: `mit`
   - SDK: **Docker** seç (Gradio/Streamlit DEĞİL)
   - Hardware: **CPU basic (free)**
   - CREATE SPACE
3. Bilgisayarında cloud-brain klasörüne git:
   ```
   cd ../cloud-brain
   ```
   DOĞRULAMA:
   ```
   ls
   ```
   BEKLENEN: `main.py  requirements.txt  ai  api  services` görünür.

4. Bu klasörde bir `Dockerfile` OLMALI. Kontrol et:
   ```
   ls Dockerfile
   ```
   Eğer "No such file" derse, AŞAĞIDAKİ Dockerfile'ı oluştur
   (Bölüm 7-EK'e bak), sonra devam et.

5. Space'i git ile bağla (HF sayfasındaki komutları kullan):
   ```
   git remote add hf https://huggingface.co/spaces/KULLANICIADI/teachmate-brain
   git add .
   git commit -m "Teachmate brain ilk yükleme"
   git push hf main
   ```
   BEKLENEN: HF Space sayfasında "Building" → "Running" durumu.
   Bu 3-8 dakika sürer.

6. Çalışınca adres şu olur:
   ```
   https://KULLANICIADI-teachmate-brain.hf.space
   ```
   Bunu `.env` dosyasındaki `EXPO_PUBLIC_API_BASE` değerine yapıştır.

   DOĞRULAMA — tarayıcıda aç:
   ```
   https://KULLANICIADI-teachmate-brain.hf.space/api/health
   ```
   BEKLENEN: `{"status":...}` gibi bir JSON. Hata sayfası gelirse
   HF Space "Logs" sekmesine bak, hatayı rapor et.

### 7-EK: Dockerfile (cloud-brain klasöründe yoksa oluştur)

`dijital-ogretmen-asistani/apps/cloud-brain/Dockerfile` adıyla:
```
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
```
> HF Spaces 7860 portunu bekler. Port 8000 DEĞİL, 7860 yaz.

`requirements.txt` içinde en az şunlar olmalı (yoksa ekle):
```
fastapi>=0.110
uvicorn[standard]>=0.27
pydantic>=2.0
openai>=1.0
python-multipart>=0.0.9
```

---

## 8. APK ÜRET (asıl hedef)

teachmate-mobile klasörüne geri dön:
```
cd ../teachmate-mobile
```

EAS hesabına giriş yap:
```
eas login
```
BEKLENEN: Expo hesabı e-posta/şifre sorar. Hesabın yoksa
`https://expo.dev/signup` adresinden ücretsiz aç.

Projeyi EAS'e bağla:
```
eas init
```
BEKLENEN: Bir `projectId` oluşturur ve app.json'a yazar.
"REPLACE_WITH_EAS_PROJECT_ID" otomatik değişir.

APK derle:
```
eas build -p android --profile preview
```
BEKLENEN:
- Android keystore yoksa "Generate a new Android Keystore?" sorar → **Yes**
- Derleme bulutta yapılır, 10-20 dakika sürer.
- Sonunda bir indirme linki verir:
  `https://expo.dev/artifacts/.../teachmate.apk`

Bu linkten APK'yı indir. APK budur. Dağıtacağın dosya budur.

> SHA-1 GEREKİRSE (Bölüm 6 adım 4 için):
> ```
> eas credentials
> ```
> → Android → Keystore → "Download" veya görüntüle → SHA-1 Fingerprint'i kopyala.

---

## 9. APK'YI SADECE İZİN VERDİKLERİNE DAĞIT

APK'yı App Store / Play Store'a KOYMA. Sadece şu yollarla dağıt:
- İzin verdiğin kişilere doğrudan APK dosyasını gönder (e-posta, link).
- VEYA `teachmate.com.tr` üzerinde şifreli/girişli bir indirme sayfası yap.

Giriş zaten iki katmanlı kısıtlı:
1. Google "Test users" listesi (Bölüm 6).
2. Kod içindeki `ALLOWLIST` (Bölüm 6).
Bu ikisinde olmayan kimse giriş yapamaz, APK'yı indirse bile kullanamaz.

---

## 10. WEB SİTESİ (teachmate.com.tr)

Web sürümü = `dijital-ogretmen-asistani/web-modules` klasörü.
Bu statik dosyalar herhangi bir web sunucusuna konabilir.

- `web-modules/` içeriğini sunucunun kök dizinine yükle.
- Ana sayfa: `web-modules/index.html`
- Mobil cihazdan açanlar otomatik olarak yalnızca Öğrenciler,
  Yazılı Okuma ve Performans modüllerini görür (kod bunu otomatik yapar).
  Diğer modüllere tıklarsa "tablet/PC gerekli" uyarısı çıkar.

---

## HATA DURUMUNDA NE YAPACAKSIN

- Bir komut hata verirse: hatanın TAM metnini kopyala, kullanıcıya göster.
- "Şöyle olabilir" diye TAHMİN YÜRÜTME.
- Bu dosyada yazmayan bir komutu KENDİ KAFANDAN çalıştırma.
- Bir dosyanın var olduğunu varsayma — önce `ls` ile KONTROL ET.
- Build linki, adres, port gibi değerleri UYDURMA — gerçek çıktıdan al.

## ÖZET KONTROL LİSTESİ

- [ ] Node 20+, npm, git kurulu
- [ ] `npm install` başarılı
- [ ] `eas-cli` kurulu
- [ ] Google OAuth Client ID alındı, `.env`'e yazıldı
- [ ] ALLOWLIST'e izinli e-postalar eklendi (auth.ts)
- [ ] HF Space oluşturuldu, beyin push edildi, /api/health çalışıyor
- [ ] `.env` içindeki API_BASE gerçek HF adresi
- [ ] `eas build -p android --profile preview` → APK indirildi
- [ ] APK sadece izinli kişilere dağıtıldı
- [ ] web-modules teachmate.com.tr'ye yüklendi
