# TEACHMATE — CLOUDFLARE DEPLOY TALİMATI (teachmate.com.tr)

> BU BİR TALİMATTIR. ADIM ATLAMA, UYDURMA, TAHMİN YÜRÜTME.
> Her adımda BEKLENEN ÇIKTI var. Eşleşmezse DUR ve hatayı aynen rapor et.
> Bu dosyada açıkça yazmayan komutu çalıştırma.

## MİMARİ (ne kuruyoruz)

```
  Kullanıcı
     │
     ▼
  teachmate.com.tr  ◄── Cloudflare (DNS + SSL + CDN, bedava)
     │
     ├── /api/*  ──► Cloudflare Worker ──► Hugging Face Spaces (beyin/Python)
     │
     └── /*      ──► Cloudflare Pages (web-modules statik site)
```

- **Domain (teachmate.com.tr):** Ücretli (~9 USD/yıl). Bu kaçınılmaz —
  alan adının kendisi her yerde ücretlidir.
- **Hosting + Worker + SSL + CDN:** Cloudflare'de BEDAVA.
- **Beyin (Python API):** Hugging Face Spaces'te BEDAVA.

---

## ÖN KOŞUL: HF beyni çalışıyor olmalı

Bu talimattan ÖNCE `GENEL_KURULUM_TALIMATI.md` Bölüm 7'yi tamamla
(HF Space + beyin deploy). Şu adres çalışıyor olmalı:
```
https://KULLANICIADI-teachmate-brain.hf.space/api/health
```
Tarayıcıda açınca JSON dönmüyorsa, ÖNCE onu düzelt. DUR.

---

## 1. CLOUDFLARE HESABI + DOMAIN

1. `https://dash.cloudflare.com/sign-up` — ücretsiz hesap aç.
2. Domain'i Cloudflare'e ekle:
   - Dashboard → "Add a site" → `teachmate.com.tr` yaz → Continue
   - Plan: **Free** seç.
   - Cloudflare iki "nameserver" verir (örn. `xxx.ns.cloudflare.com`).
3. Domain'i NEREDEN aldıysan (GoDaddy, Namecheap, Turhost vb.):
   - O sitenin panelinde domain'in **nameserver** ayarına git.
   - Cloudflare'in verdiği iki nameserver'ı yaz, kaydet.
   BEKLENEN: Cloudflare "Pending" → birkaç saat içinde "Active" olur.
   E-posta ile "teachmate.com.tr is now active" bildirimi gelir.

> NOT: Nameserver değişikliği 5 dk–24 saat sürebilir. "Active" olmadan
> sonraki adımlarda domain çalışmaz. Bu NORMALDİR, bekle.

---

## 2. WRANGLER CLI KUR (Worker deploy aracı)

```
npm install -g wrangler
```
DOĞRULAMA:
```
wrangler --version
```
BEKLENEN: `wrangler 3.x` gibi sürüm. "command not found" derse
her komutun önüne `npx` ekle: `npx wrangler ...`

Cloudflare'e giriş:
```
wrangler login
```
BEKLENEN: Tarayıcı açılır, "Allow" dersin, terminalde
"Successfully logged in" yazar.

---

## 3. WORKER'I DEPLOY ET (API proxy)

Worker klasörüne gir:
```
cd dijital-ogretmen-asistani/deploy/cloudflare
```
DOĞRULAMA:
```
ls
```
BEKLENEN: `worker.js  wrangler.toml` görünür.

`worker.js` ve `wrangler.toml` içindeki HF adresini düzelt:
- İki dosyada da `KULLANICIADI-teachmate-brain.hf.space` yazan yeri
  KENDİ gerçek HF Space adresinle değiştir.

Deploy et:
```
wrangler deploy
```
BEKLENEN:
- "Uploaded teachmate-api" ve
- "Published teachmate-api" satırları,
- Bir `*.workers.dev` adresi.

> Eğer "route already exists" veya domain hatası verirse: domain'in
> Bölüm 1'de "Active" olduğundan emin ol. Değilse bekle, sonra tekrar dene.

DOĞRULAMA (domain Active olduktan sonra):
```
https://www.teachmate.com.tr/api/health
```
Tarayıcıda aç. BEKLENEN: HF'deki ile AYNI JSON döner.
Bu çalışıyorsa proxy tamam demektir.

---

## 4. WEB SİTESİNİ PAGES'E DEPLOY ET

Pages, `web-modules/` klasörünü barındırır.

### Yöntem A — Dashboard'dan (kolay, git gerektirmez)
1. Dashboard → "Workers & Pages" → "Create" → "Pages" →
   "Upload assets" sekmesi.
2. Proje adı: `teachmate`
3. `dijital-ogretmen-asistani/web-modules` klasörünün TÜM içeriğini
   sürükle-bırak ile yükle (index.html kök dizinde olmalı).
4. "Deploy site" → birkaç saniye → bir `teachmate.pages.dev` adresi verir.

### Yöntem B — wrangler ile
```
cd ../../web-modules
wrangler pages deploy . --project-name=teachmate
```
BEKLENEN: "Deployment complete" + `teachmate.pages.dev` adresi.

DOĞRULAMA:
```
https://teachmate.pages.dev
```
Tarayıcıda aç. BEKLENEN: Teachmate ana sayfası (hub) açılır.

---

## 5. DOMAIN'İ PAGES'E BAĞLA

1. Dashboard → Workers & Pages → `teachmate` (Pages projesi) →
   "Custom domains" sekmesi → "Set up a custom domain".
2. `www.teachmate.com.tr` yaz → Continue → Activate.
   (Cloudflare DNS kaydını otomatik ekler.)
3. Kök domain için de tekrarla: `teachmate.com.tr`.

DOĞRULAMA (birkaç dakika sonra):
```
https://www.teachmate.com.tr
```
BEKLENEN: Site açılır, SSL kilidi (https) yeşil/kapalı kilit görünür.

> ÖNEMLİ SIRA: Worker route'u (`/api/*`) Pages'ten ÖNCELİKLİDİR.
> Yani `www.teachmate.com.tr/api/health` → Worker → HF'ye gider;
> `www.teachmate.com.tr/` → Pages statik siteye gider. Bu otomatiktir.

---

## 6. SON DOĞRULAMA (uçtan uca)

Tarayıcıda sırayla test et:

1. `https://www.teachmate.com.tr`
   BEKLENEN: Ana sayfa (hub) açılır.

2. `https://www.teachmate.com.tr/api/health`
   BEKLENEN: JSON (beyin yanıtı).

3. Hub'da "Maarif Performans" modülünü aç, bir değerlendirme dene.
   BEKLENEN: Sonuç döner (beyin /api/maarif/evaluate çalışıyor).

4. Mobil cihazdan `https://www.teachmate.com.tr` aç.
   BEKLENEN: Yalnızca Öğrenciler, Yazılı Okuma, Performans aktif;
   diğer modüllere tıklayınca "tablet/PC gerekli" uyarısı.

Hepsi çalışıyorsa: web yayında. ✅

---

## 7. MOBİL APK'YI BU ADRESE BAĞLA

`apps/teachmate-mobile/.env` dosyasında:
```
EXPO_PUBLIC_API_BASE=https://www.teachmate.com.tr
```
olduğundan emin ol. Böylece APK de aynı proxy'yi kullanır —
HF adresi değişse bile APK'yı güncellemene gerek kalmaz.
Sonra `GENEL_KURULUM_TALIMATI.md` Bölüm 8 ile APK'yı derle.

---

## MALİYET ÖZETİ

| Kalem | Ücret |
|---|---|
| Domain (teachmate.com.tr) | ~9 USD/yıl (kaçınılmaz) |
| Cloudflare Pages (hosting) | Bedava |
| Cloudflare Worker (API proxy) | Bedava (günde 100.000 istek) |
| Cloudflare SSL + CDN + DNS | Bedava |
| Hugging Face Spaces (beyin) | Bedava (CPU basic) |

**Tek ücret: domain.** Gerisi bedava.

---

## HATA DURUMUNDA

- Komut hata verirse TAM metnini kopyala, göster. Tahmin yürütme.
- `/api/health` JSON dönmüyorsa: önce HF Space "Logs"a bak.
- Site açılmıyorsa: domain "Active" mi kontrol et (Bölüm 1).
- Bu dosyada yazmayan komutu çalıştırma.
