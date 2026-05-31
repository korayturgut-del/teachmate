# TEACHMATE — APK BOYUTU KÜÇÜLTME

## 308 MB neden? (panik yok)

`eas build --profile preview` ile çıkan APK **universal APK**'dır:
4 farklı işlemci mimarisini (armeabi-v7a, arm64-v8a, x86, x86_64)
TEK dosyada taşır. Yani aynı uygulamanın 4 kopyası bir arada.

**Telefona kurulduğunda** cihaz sadece KENDİ mimarisini kullanır;
gerçek kurulu boyut ~80-100 MB'dir, 308 değil. Ama dağıttığın
dosya 308 MB görünür. Aşağıdakiler bunu düşürür.

---

## ÇÖZÜM 1 — ProGuard + Resource Shrink (zaten açıldı)

`app.json` içine eklendi (expo-build-properties):
- `enableProguardInReleaseBuilds: true`  → ölü Java/Kotlin kodunu atar
- `enableShrinkResourcesInReleaseBuilds: true` → kullanılmayan kaynakları atar
- `enablePngCrunchInReleaseBuilds: true` → PNG'leri sıkıştırır

Bunun çalışması için bağımlılığı kur:
```
npm install
```
BEKLENEN: expo-build-properties paketi kurulur.

Tek başına bu, release build'de ~%20-30 düşürür.

---

## ÇÖZÜM 2 — Tek mimari APK (EN ETKİLİ, tavsiye edilen)

Modern Android telefonların HEPSİ **arm64-v8a** kullanır.
Sadece onu derlersen APK ~80-100 MB'a iner (308 yerine).

### Yöntem: gradle ABI filtresi

`android/gradle.properties` dosyasına (EAS build prebuild sonrası
oluşur) şu satır eklenir. Ama Expo managed'da bunu app.json'dan
yönetmek için, build öncesi şu ortam değişkenini ver:

EAS build komutunu şöyle çalıştır:
```
EAS_BUILD_ANDROID_ABI=arm64-v8a eas build -p android --profile preview
```

VEYA daha kalıcı: prebuild yapıp gradle'ı düzenle:
```
npx expo prebuild -p android
```
Sonra oluşan `android/app/build.gradle` içinde `splits` bloğu bul/ekle:
```
android {
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a"
            universalApk false
        }
    }
}
```
Sonra:
```
eas build -p android --profile preview --local
```
BEKLENEN: Sadece arm64-v8a APK, ~80-100 MB.

> NOT: arm64-v8a APK çok eski (2015 öncesi) cihazlarda çalışmaz.
> Pratikte tüm güncel telefonlar arm64'tür, sorun olmaz.

---

## ÇÖZÜM 3 — AAB (sadece Play Store'a koyarsan)

Play Store'a koymayacaksan ATLA. Koyacaksan:
```
eas build -p android --profile production
```
AAB üretir. Play Store her cihaza sadece kendi mimarisini gönderir,
kullanıcı ~40-60 MB indirir. Ama AAB doğrudan kurulamaz, sadece
Store üzerinden dağıtılır.

---

## HANGİSİNİ SEÇMELİYİM?

| Durum | Çözüm |
|---|---|
| APK'yı elden/linkle dağıtacağım (senin durumun) | **Çözüm 1 + 2** → tek arm64 APK, ~80-100 MB |
| Play Store'a koyacağım | Çözüm 3 (AAB) |

Senin için: **Çözüm 1 (zaten açık) + Çözüm 2 (arm64 split)**.
Sonuç: 308 MB → ~80-100 MB.

---

## DOĞRULAMA

Build bitince EAS indirme linkindeki APK boyutunu kontrol et.
- 308 MB → universal (split yapılmamış)
- ~80-100 MB → arm64 split başarılı ✅
