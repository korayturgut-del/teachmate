# Mobil Platform Başlatma Kılavuzu

## Gereksinimler

- Node.js >= 18
- React Native CLI (`npx react-native`)
- **Android:** Android Studio, JDK 17+, Android SDK 34+
- **iOS (sadece macOS):** Xcode 15+, CocoaPods

## Android Platformunu Başlatma

```bash
cd apps/mobile

# Android dizinini oluştur
npx react-native init DijitalOgretmenMobile --directory android-temp --skip-install
# Android yapısını kopyala
xcopy android-temp\android android\ /E /I
# Geçici dizini sil
rmdir android-temp /S /Q

# VEYA doğrudan (mevcut dizinde):
npx react-native@latest init DijitalOgretmenMobile --directory . --skip-install
```

**DİKKAT:** `npx react-native init` mevcut package.json dosyasını ezecektir.
Bu nedenle ÖNCE yedek alın veya temp dizin kullanın:

```bash
# Önerilen yöntem: Yedekle → init → geri yükle
copy package.json package.json.bak
copy tsconfig.json tsconfig.json.bak
copy babel.config.js babel.config.js.bak
copy metro.config.js metro.config.js.bak

npx react-native@latest init DijitalOgretmenMobile --directory . 

copy package.json.bak package.json
copy tsconfig.json.bak tsconfig.json
copy babel.config.js.bak babel.config.js
copy metro.config.js.bak metro.config.js

del *.bak
npm install
```

## iOS Platformu (sadece macOS)

```bash
cd apps/mobile/ios
pod install
```

## react-native-vision-camera Özel Ayarları

### Android

`android/app/build.gradle` içinde:

```gradle
android {
    compileSdkVersion 34  // veya üstü
    
    defaultConfig {
        minSdkVersion 26  // Vision Camera minimum 21
        targetSdkVersion 34
    }
}
```

`android/app/src/main/AndroidManifest.xml` içine kamera izni:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### iOS

`ios/DijitalOgretmenMobile/Info.plist` içine:

```xml
<key>NSCameraUsageDescription</key>
<string>Kağıt okumak için kamera erişimi gerekiyor</string>
```

## Çalıştırma

```bash
# Metro bundler başlat
npx react-native start

# Android (başka terminal)
npx react-native run-android

# iOS (başka terminal, sadece macOS)
npx react-native run-ios
```
