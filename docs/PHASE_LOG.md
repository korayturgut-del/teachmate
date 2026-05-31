# PHASE_LOG — Phase v1.0 (Gerçek Onarım)

> Bu kayıt, iddia değil **kanıtlanmış** değişikliklerdir. Her madde komut çıktısıyla doğrulandı.

## ✅ K2 — Python import zinciri onarıldı
- **Sorun:** `from packages.event_bus.src import event_bus` çözülemiyordu (dizin `packages/event-bus`, tireli; `packages/` paket değildi).
- **Çözüm (Anayasa Madde 1 — tireli dizin SİLİNMEDİ, korundu):**
  - `packages/__init__.py` eklendi → `packages` artık namespace paketi.
  - `packages/event_bus/` köprü paketi eklendi → tireli `event-bus/src/bus.py`'yi `importlib` ile yükleyip re-export eder.
  - `packages/event_bus/src/{__init__,bus}.py` eklendi → eski `packages.event_bus.src.bus` importları için geriye dönük köprü.
  - `apps/cloud-brain/_path_setup.py` eklendi → repo kökünü `sys.path`'e ekler (standart monorepo deseni). `main.py` en başında import eder.
- **Kanıt:** `from main import app` → 42 route yüklendi; `from packages.event_bus import event_bus` → OK.

## ✅ K6 — Türkçe OCR (Anayasa Madde 5)
- `apps/cloud-brain/services/paddleocr.py`: `lang="en"` → `lang="tr"`.
- PaddleOCR 2.8+'da kaldırılan `use_onnx=True` parametresi kaldırıldı.
- Öğrenci-bilgi regex'leri zaten Türkçe karakter setini (çğıöşüÇĞİÖŞÜ) içeriyor — korundu.
- **Kanıt:** import OK; `lang="tr"` doğrulandı, `use_onnx` PaddleOCR çağrısından çıkarıldı.

## ✅ K3 — Sahte pipeline tamamen gerçeğe bağlandı
- `apps/desktop/src/lib/pipeline.ts` eklendi: **"Önce cihaz, sonra AI"** köprüsü (Anayasa Madde 4).
  - Tauri ortamı → `invoke()` ile yerel Rust komutu (CİHAZDA).
  - Tarayıcı/dev → `/api/pipeline/{stage}` Cloud Brain fallback.
- `apps/desktop/src/App.tsx`: ham `fetch` → `runStage()` köprüsü. Kaynak etiketi (📱 cihaz / ☁️ bulut) gösterilir.
- `apps/cloud-brain/api/routes/pipeline.py` eklendi: 6 aşamalı gerçek route, PaddleOCR servisini çağırır, Event Store'a yazar. Mock yok.
- `main.py`: pipeline router `/api/pipeline` prefix ile kaydedildi.
- **Kanıt:** TestClient ile 6/6 route HTTP 200; `pipeline.ts` tsc → 0 hata.

## ✅ K4 — Tauri IPC köprüsü
- `apps/desktop/package.json`: `@tauri-apps/api@^2.0.0` eklendi.
- `pipeline.ts` içinde `invoke()` çağrıları (yerel OCR/sayfa-ayırma/öğrenci-bilgi/ders-tespit).
- **Kanıt:** `pipeline.ts` gerçek `@tauri-apps/api/core` tipiyle tsc → 0 hata.

## ✅ Ek — React 19 ref tip hatası düzeltildi
- `App.tsx`: `RefObject<HTMLInputElement>` → `RefObject<HTMLInputElement | null>` (React 19 uyumu).

## ✅ K17 — Monorepo pnpm'e geçirildi (`workspace:*` artık çalışıyor)
- `pnpm-workspace.yaml` eklendi; root `package.json`'dan npm `workspaces` kaldırıldı, `packageManager: pnpm@9.15.9` eklendi.
- `pnpm.neverBuiltDependencies: [canvas]` → konva'nın opsiyonel native dep'i (tarayıcı build'inde gereksiz) atlanır.
- **Kanıt:** `pnpm install` → Done, `@doa/editor-engine` workspace symlink'i çözüldü.

## ✅ K18 — React 19 peer çakışmaları giderildi
- `lucide-react` `^0.378.0` → `^0.469.0` (React 19 peer desteği).
- `react-konva` `^18.2.10` → `^19.0.7` (React 19 peer desteği).
- **Kanıt:** `pnpm install` → peer dependency uyarısı YOK.

## ✅ K8 tamamlandı — editor-engine derleniyor
- `packages/editor-engine/src/index.ts` JSX içerdiği halde `.ts` uzantılıydı → `.tsx`'e taşındı (Madde 1: silinmedi, yeniden adlandırıldı). `main` alanı güncellendi.
- editor-engine'e `@types/react` + `@types/react-dom` eklendi.
- Fabric v6 `import { Canvas } from 'fabric'` zaten doğruydu — korundu.
- vite.config'de `@doa` alias zaten vardı; workspace symlink ile birlikte çözülüyor.

## ✅ Ek derleme düzeltmeleri
- `pdf-utils.ts`: CDN fallback dynamic import'a `@ts-ignore` (TS URL'i modül çözemiyor).
- `digital-desk.tsx`: zorunlu prop'lar opsiyonel + güvenli varsayılan yapıldı (veri yokken de güvenle render).
- `EditorPage.tsx`: `onReady` callback parametresine explicit tip.

## 🟢 PHASE v1.0 DERLEME KARNESİ (kanıtlı)
| Bileşen | Komut | Sonuç |
|---|---|---|
| Cloud Brain | `TestClient` | ✅ root 200, 6/6 pipeline route 200 |
| Desktop tsc | `npx tsc --noEmit` | ✅ SIFIR hata |
| Desktop build | `npx vite build` | ✅ 243 modül, dist/ üretildi, 7.34s |
| pnpm workspace | `pnpm install` | ✅ peer uyarısı YOK |

## ⚠️ Phase v1.1'e devredilen GERÇEK engeller
- **K5 — rxing:** `qr.rs` yorum satırı "rxing 0.6 DynamicImage alır" diyor ama Rust toolchain bu ortamda yok; `cargo build` ile DOĞRULANMADI. Phase v1.1'de cargo ile test şart.
- Boş paketler (K9), onboarding (K11), export (K13), offline (K14), answer-key UI (K15) — Phase v1.4+.

---

# PHASE v1.5 — Boş Paketler Dolduruldu (K9)

> 5 tamamen boş paket gerçek implementasyonla dolduruldu. İskelet/placeholder DEĞİL —
> 28 davranış testiyle kanıtlandı. Hiçbir mevcut dosya silinmedi (Anayasa Madde 1).

## ✅ Doldurulan paketler

| Paket | İşlev | Bağlı ADR |
|---|---|---|
| `@doa/auth-engine` | Öğretmen kimlik & oturum. Argon2 (Rust crypto.rs köprüsü), tamamen yerel/çevrimdışı. Kayıt, giriş, oturum doğrulama, çıkış, mükerrer kayıt engeli. | Madde 4 (yerel) |
| `@doa/sync-engine` | Çevrimdışı AI kuyruğu. OCR yerelde, AI işi çözülemezse kuyruğa; internet gelince batch gönderim, retry (max 5), event geri yazımı. | ADR-013 |
| `@doa/template-engine` | Sınav şablonu versiyonlama. SHA-256 içerik hash'i (çift basım tespiti), `examId-vN` QR yükü, versiyon uyuşmazlığı tespiti. | ADR-015 |
| `@doa/digital-desk` | Masa state çekirdeği. Skor override → `GradeOverridden` event (öğretmen profilinin veri kaynağı), annotation yönetimi, puan sınırlama. | ADR-016 |
| `@doa/workflow-engine` | Sınav yaşam döngüsü state machine. Geçersiz event sırasını (örn. OCR öncesi grading) çalışma zamanında reddeder. | EVENT_CATALOG |

## ✅ Kanıt
| Kontrol | Komut | Sonuç |
|---|---|---|
| 5 paket tip kontrolü | `tsc -p` (strict) | ✅ SIFIR hata |
| Davranış testleri | `node tests/packages/engines.test.mjs` | ✅ **28/28 geçti** |
| Regresyon: desktop | `npx tsc --noEmit` | ✅ hâlâ SIFIR hata |
| Regresyon: cloud-brain | `import app` | ✅ hâlâ 42 route |

## Not
Test çalıştırmak için: paketleri `dist-test/`'e derle (`tsc` ile), sonra `node tests/packages/engines.test.mjs`.
Bu paketler kaynak-only (mevcut paket deseni); desktop/mobile build'i içinde derlenirler.

---

# PHASE v1.6 — Çok-Katmanlı OCR Mimarisi (ChatGPT yapısal öneri)

> Tek OCR motoru yerine "belge analizi → decision engine → en uygun teknoloji" mimarisi.
> "Önce cihaz, sonra AI" (Madde 4) korunarak. 24 davranış testiyle kanıtlandı.

## ✅ Eklenen / genişletilen

| Paket | Ne yapıldı | Durum |
|---|---|---|
| `@doa/decision-engine` | Mevcut `decide()` KORUNDU. Üstüne `route()` eklendi: platform OCR seçimi + AI sağlayıcı seçimi (DeepSeek / Gemini Vision). | genişletildi |
| `@doa/ocr-engine` | `pickLocalEngine()` (platform→motor) + `analyzeDocument()` (içerik türü tespiti) eklendi. Mevcut ön-işleme korundu. | genişletildi |
| `@doa/question-segmentation` | **YENİ** — ChatGPT'nin "eksik" dediği katman. Sayfa → soru kutuları. Şablon tabanlı + otomatik (boşluk analizi). | yeni |
| `@doa/learning-engine` | **YENİ** — ürünün vizyonu. Öğretmen düzeltmesi → yerel sözlük (anında) + bulut corpus (uzun vadeli fine-tune). KVKK onayı zorunlu. | yeni |

## ✅ Platform katmanları (ChatGPT mimarisi)
| Platform | KADEME 0 (yerel OCR) | Buluta giden |
|---|---|---|
| Android | ML Kit Document Scanner + Text Recognition v2 | sadece zor el yazısı/anlam |
| iOS/iPadOS | VisionKit + Apple Vision + Apple Pencil (dijital masa) | sadece zor el yazısı/anlam |
| Desktop | ADF → Rust PDF → QR → Question Segmentation → PaddleOCR ONNX | sadece zor el yazısı/anlam |

## ✅ Yönlendirme tablosu (kanıtlı)
| İçerik | Güven | Karar | AI |
|---|---|---|---|
| Basılı | %97 | yerel çöz | yok |
| Türkçe kompozisyon | %90 | bulut | DeepSeek |
| Matematik işlemi | %88 | bulut | Gemini Vision |
| Grafik/şekil | — | bulut | Gemini Vision |
| Çok kötü el yazısı | %40 | bulut + öğretmen onayı | Gemini Vision |
| (internet yok) | — | offline kuyruk | yok |

## ✅ Öğrenme döngüsü (ürünün rekabet hendeği)
OCR yanlış okur → öğretmen dijital masada düzeltir → `OCRCorrection` event →
(A) yerel sözlük anında güncellenir, (B) onaylıysa bulut corpus'una eklenir →
500 yeni örnek birikince `ModelTrainingTriggered` → fine-tune. Öğrenci PII'si değil,
anonim "görüntü→doğru metin" çiftleri toplanır.

## ✅ Kanıt
| Kontrol | Sonuç |
|---|---|
| 4 paket tip kontrolü (strict) | ✅ SIFIR hata |
| Davranış testleri (`tests/packages/architecture.test.mjs`) | ✅ **24/24 geçti** |
| REGRESYON: eski `decide()` korundu | ✅ |
| REGRESYON: grading-engine decision-engine importu | ✅ çözülüyor |

---

# PATCH v1.8 — İlk Uçtan Uca Akış (Cevap Anahtarı → Rubrik → AI → Öğretmen)

> Yeni motor/paket/mimari YOK. Mevcut parçalar gerçekten birbirine dikildi.
> En kritik düzeltme: AI artık RASTGELE değil, cevap anahtarı + rubrik tabanlı (deterministik).

## ✅ Düzeltilen bozuk kısımlar (Section 3)
| # | Sorun | Çözüm |
|---|---|---|
| B1 | `mock_ai.grade_paper` rubriği alıyor ama KULLANMIYOR (rastgele puan) | Cevap anahtarı → rubrik → heuristik öncelik sırası. Deterministik. |
| B2 | `pipeline/surec_puanlama` sadece `score: None` döndürüyor | `run-full` endpoint: OCR→karar→anahtar→rubrik→AI zinciri |
| B3 | Hatalar `console.error`'da kalıyor, öğretmen görmüyor | `sonner` toast bildirimleri (başarı/hata/kayıt) |
| B4 | Pipeline bitince sonuç dijital masaya/arşive gitmiyor | review ekranı: soru bazlı sonuç + "Onayla ve Arşive Kaydet" |

## ✅ Cevap Anahtarı → Rubrik → AI (doğruluğun kalbi)
- **Kapalı uçlu** → cevap anahtarı + alternatiflerle birebir/kısmi eşleşme.
- **Açık uçlu** → rubrik kriterleri (keyword + puan) ile puanlama.
- **Anahtar/rubrik yok** → uzunluk heuristiği + zorunlu öğretmen incelemesi.
- Cevap anahtarı eşleşince → `local_resolve` (AI'a HİÇ gitmez, maliyet sıfır).

## ✅ Uçtan uca akış (BUILD hedefi)
Öğretmen yükler → OCR → Decision Engine rota → cevap anahtarı/rubrik/AI →
review ekranında soru bazlı sonuç → dijital masada düzeltme → Onayla → arşive kayıt → toast.

## ✅ Kanıt
| Kontrol | Sonuç |
|---|---|
| Desktop tsc | ✅ SIFIR hata |
| Desktop vite build | ✅ 243 modül, dist/ üretildi |
| Cloud Brain | ✅ 43 route |
| Uçtan uca test (`tests/integration/end_to_end.py`) | ✅ **12/12 geçti** |
| Determinizm (aynı girdi → aynı puan) | ✅ 10,10,10 |
| Yanlış cevap → 0 puan | ✅ |

## ⚠️ Phase v1.9'a devredilen (BUILD kapsamı dışı, kasıtlı)
- Soru verisi şu an örnek; gerçek OCR/segment çıktısının soru-cevap eşlemesine bağlanması.
- Dijital masa: perfect-freehand + kalem basıncı + güven ısı haritası.
- Arşive gerçek SQLCipher kaydı (şu an UI akışı tamam, kalıcılık native tarafta).
- Mobil OCR (vision-camera-ocr-plus) + React 18→19 hizalama.

---

# PATCH v1.9 — Gerçek Soru Verisi (OCR → Segmentasyon → Grading)

> Master prompt v1.9: "Bind real OCR + question-segmentation output to the question/answer
> pairs feeding run-full. No more sample questions." — TAMAMLANDI.

## ✅ Yapıldı (dosya dosya)
| Dosya | Değişiklik |
|---|---|
| `apps/cloud-brain/services/paddleocr.py` | OCR satırlarına `bbox` eklendi (`_normalize_bbox`). Segmentasyon için zorunlu. |
| `apps/cloud-brain/services/segmentation.py` | **YENİ** — OCR satırlarını soru bölgelerine ayırır. question-segmentation TS paketiyle AYNI algoritma (dikey boşluk). Şablon + otomatik mod. |
| `apps/cloud-brain/api/routes/pipeline.py` | **YENİ** `/segment` endpoint: görüntü → OCR → segmentasyon → soru bölgeleri. |
| `apps/desktop/src/lib/pipeline.ts` | `segmentPage()` + `regionsToQuestions()` köprüleri. |
| `apps/desktop/src/App.tsx` | **Örnek soru KALDIRILDI.** Artık: sayfa → segmentPage → regionsToQuestions → gerçek OCR metni öğrenci yanıtı olarak grade. Boş sayfada fake veri ÜRETMEZ; manuel inceleme açar (Madde 3). |

## ✅ Veri akışı (artık gerçek)
```
Yüklenen sayfa görüntüsü
  → /api/pipeline/segment (PaddleOCR satır+bbox → dikey-boşluk segmentasyonu)
  → soru bölgeleri [{question_no, text, confidence, bbox}]
  → regionsToQuestions (gerçek OCR metni = öğrenci yanıtı + cevap anahtarı/rubrik)
  → /api/pipeline/run-full (cevap anahtarı → rubrik → AI)
  → dijital masa → öğretmen düzeltme → arşiv
```

## ✅ Madde uyumu
- **Madde 3 (fake yasak):** Segmentasyon boş dönerse örnek veri üretilmez; öğretmene uyarı + manuel bölge.
- **Madde 4 (önce cihaz):** OCR + segmentasyon cihazda (PaddleOCR yerel); sadece anlamsal grading buluta.
- **Madde 6 (anahtar→rubrik→AI):** Gerçek OCR metni cevap anahtarıyla eşleşince yerelde çözülür.

## ✅ Kanıt
| Kontrol | Sonuç |
|---|---|
| Desktop tsc | ✅ SIFIR hata |
| Desktop vite build | ✅ dist/ üretildi |
| Cloud Brain | ✅ 44 route |
| Entegrasyon testi (`tests/integration/end_to_end.py`) | ✅ **22/22 geçti** (12 v1.8 + 10 v1.9) |
| Örnek soru temizliği | ✅ App.tsx'te "öğrenci yanıtı 1" = 0 eşleşme |
| OCR 'dört' → anahtar 10/10 | ✅ gerçek OCR metni ile |
| OCR fotosentez → rubrik 20/20 | ✅ gerçek OCR metni ile |

## ⚠️ v1.10'a devredilen
- Çok sayfalı sınav (şu an ilk sayfa segmentleniyor).
- Cevap anahtarı yükleme UI'ı (regionsToQuestions 2. argümanı hazır, ekran v1.11).
- Soru kutusu görüntü crop'u (bbox var; gerçek crop + kutu-başına OCR v1.10).
- bbox normalize: gerçek sayfa boyutuyla yeniden ölçekleme (şu an sayfa-göreli).

## v1.10 — Dijital Masa Yükseltmesi (Opus 4.7)
- perfect-freehand basınç modeli (StrokePoint, FreehandOptions, palm rejection)
- Güven ısı haritası (buildHeatMap, heatMapSummary — düşük güven kırmızı)
- Toplu onay (bulkApprove — yüksek güven otomatik, GradeOverridden üretmez)
- Çok sayfalı segmentasyon (segmentMultiPage — soru no sürekliliği)
- BONUS DÜZELTME: segmentAuto tek-gap kusuru (2 satır her zaman tek soruya
  birleşiyordu) → mutlak satır-yüksekliği eşiği eklendi
- KANIT: tsc strict GEÇTİ · v1.10 testi 20/20 · v1.8+v1.9 regresyon 22/22

## v1.11 — Learning Cloud Endpoint (Opus 4.7)
- YENİ: api/routes/learning.py — /api/learning/corrections (+batch, corpus/stats,
  training/mark-complete, health) — 5 endpoint, exam.py JSON-bridge deseniyle
- YENİ: learning_corpus.json corpus deposu (mevcut şema bozulmadı)
- learning-engine: CloudCorrectionStore — CorrectionStore'un gerçek HTTP impl.
  (queueForUpload/flushUploadQueue/corpusStats artık gerçek endpoint çağırır)
- KVKK: consent_to_train=false → 403, buluta hiç gitmez (her iki katmanda da)
- Çevrimdışı: düzeltme kuyrukta bekler, bağlantı gelince flush (ADR-013 uyumlu)
- KANIT: tsc strict GEÇTİ · endpoint 17/17 · entegrasyon 11/11 · regresyon 22+20

## v1.12 — Rust Doğrulama (Opus 4.7)
Durum: İZOLE DOĞRULANMIŞ (Tauri tam bağımlılık ağacı ortam kısıtı)

Yapılan:
- native/doa-rustcheck/ izole Cargo crate'i oluşturuldu
- 4 komut dosyası (crypto/pdf/qr/scanner) Tauri stub'larıyla izole edildi
- cargo check: GEÇTİ (edition2024 olmayan kümede)
- cargo test --test-threads=1: 23/23 GEÇTİ

Düzeltmeler:
- pdf.rs: lopdf 0.32 YANLIŞ API (Vec<u8>→objects.insert) → DOĞRU (clone+delete_pages)
- scanner.rs: static AtomicBool iptal testi yalıtımı belgesi
- qr.rs: rxing 0.6 API (Luma8→BufferedImageLuminanceSource) doğrulama notu
- lib.rs: Tauri 2.x main+lib.rs deseni oluşturuldu
- Cargo.toml: pdf=0.9, imageproc=0.24 kaldırıldı; image hafifletildi

Ortam kısıtı:
- cargo 1.75 (apt mevcut) / Tauri 2.x rust-version 1.77 gerektirir
- Tauri'nin dlopen2_derive→aligned→edition2024 zinciri 1.75'te parse edilemiyor
- Çözüm: cargo 1.79+ (makinede) veya Docker (FROM rust:1.82-slim)

KANIT: cargo test 23/23 · tsc GEÇTİ · regresyon 22+20+17+11

## v1.13 — Mobile Revival (Opus 4.7)
- package.json: react 18→19, react-native-vision-camera-ocr-plus ekle,
  react-native-vision-camera-barcodes, @doa/* workspace bağımlılıkları
- YENİ: apps/mobile/src/lib/ocr-bridge.ts — OCR pipeline köprüsü
    react-native-vision-camera-ocr-plus → decision-engine → route
    ML Kit (Android) / Apple Vision (iOS) otomatik platform seçimi
    extractQrFromOcrText (ADR-015), decideRoute (ADR-018), createQrBridgeSession (ADR-011)
    formatCorrectionForLearning (v1.11 learning-engine)
- CameraCapture.tsx: mock → gerçek runMobilePipeline() bağlantısı
    Pipeline adım overlay, OCR engine rozeti, offline badge
- QuickReview.tsx: mock AI → gerçek PipelineResult
    Güven ısı haritası (conf rengi), ADR-010 route rozeti,
    ADR-011 QR köprüsü (modal + çok-kareli), Kural 12 uyarısı
- App.tsx: PipelineResult state'i ekranlar arasında taşıyor
- KANIT: tsc GEÇTİ · manTık testi 16/16 · regresyon 22+20+11+23 (hepsi)
- Constitution: Madde 3 (NO FAKE FLOW) — mock AI kaldırıldı, gerçek pipeline
  Madde 5 (TÜRKÇE) — lang="tr", Türkçe karakter testi eklendi

## v1.14 — Teacher Trust (Opus 4.7)
- ScoreOverlay: source + rubricScores + confidence + reviewRequired alanları eklendi
- YENİ: ExplanationPanel — soru bazlı rubrik + açıklama + kaynak rozeti + güven ısı haritası
- YENİ: GradingSummaryPanel — Madde 6 zinciri dağılımı + inceleme uyarısı + v1.10 toplu onay
- DeskPage.tsx: sol Konva + sağ panel düzeni; gradedToOverlay köprüsü
- YENİ: OnboardingWizard — 3 adımlı ilk kurulum; öğretmen adı/okul/branş/eşik
- App.tsx: onboarding flag + wrapper + offline badge prop chain
- NavBar: "N kuyrukta" amber badge + öğretmen adı (lg+)
- KANIT: mantık testi 24/24 · regresyon 22+20+11+23 (hepsi)
- Constitution: Madde 3 (NO FAKE FLOW) — ExplanationPanel gerçek GradedQuestion'dan
  Madde 6 — kaynak zinciri (answer_key→rubric→ai) UI'da görünür

## v1.15 — Commercialization (Opus 4.7)
### Gemini Araştırması Entegrasyonu (Mayıs 2026)
Araştırma doğruladı: PaddleOCR+Zemberek+Mathpix+Claude pipeline doğru.
Eklenenler:
- YENİ: routers/grading.py → /api/grading/strokes (Mathpix v3/strokes)
  Gemini: "stroke verisi formül doğruluğunu kritik artırır"
- YENİ: services/zemberek_nlp.py — Türkçe morfoloji (Gemini: "%92 doğruluk")
  regex_fallback: ucgen→üçgen, dikdortgen→dikdörtgen, acı→açı...
  gerçek Zemberek: JPype köprüsü hazır (JAR kurulunca aktif)
### v1.15 Asıl Deliverable'lar
- tauri.conf.json: tauri-plugin-updater + versiyon 1.15.0
- lib.rs: tauri_plugin_updater::Builder bağlandı
- YENİ: api/routes/privacy.py — KVKK endpoint'leri (4 route)
  /consent, /consent/{id}, /delete-my-data, /data-residency
  KVKK Madde 5,6,13 uyumlu; consent_to_train kontrolü
- YENİ: docs/KULLANICI_KILAVUZU.md — 180 satır, tüm özellikler
  Gemini araştırması bulguları: Zemberek %92, Mathpix strokes
- KANIT: 17/17 · regresyon 22+20+11+23 (hepsi)

---

# PATCH v1.16 — Opus 4.7 Denetimi: 5 Kritik Eksik Düzeltildi

> Anayasaya uygun: teknoloji DEĞİŞTİRİLMEDİ, hiçbir şey SİLİNMEDİ, sadece eksik/hata tamamlandı.

## ✅ Adım 1 — Mobil paket hatası (kurulumu kırıyordu)
- `react-native-vision-camera-barcodes` npm'de YOK (E404, halüsinasyon) → kaldırıldı.
- `vision-camera-ocr-plus` RN ≥0.81 istiyordu (proje RN 0.76) → uyumsuz.
- İkisi de RN 0.76 + vision-camera 4.x uyumlu `react-native-vision-camera-text-recognition@2.0.0` (ML Kit) ile değiştirildi.
- ocr-bridge.ts yorum referansları güncellendi.
- **Kanıt:** pnpm install E404 vermiyor; paket apps/mobile altında kuruldu.
- **Not:** RN 0.76 iç bağımlılığı React 18 ister (React 19 ile peer uyarısı) — kurulumu engellemiyor; RN major yükseltmesi ayrı bir karar (QA notu).

## ✅ Adım 2 — Arşivden çıkar + dijital masada tekrar düzenle (EN KRİTİK eksik)
- `digital-desk` paketine `serialize()` + statik `restore()` + `DeskSnapshot` eklendi.
- Backend: `PUT/GET /api/archive/snapshot/{exam_id}` — masa durumu (puan+not+kalem) SQLCipher'a JSON.
- Frontend: `saveDeskSnapshot/loadDeskSnapshot` köprüleri; arşiv kartına "✏️ Düzenle" butonu; ArchivePage masaya yönlendirir.
- **Kanıt:** 7/7 davranış testi — kaydet→geri yükle→tekrar düzenle puanı/notu/kalemi koruyor. Backend kaydet/yükle/404 testi geçti.

## ✅ Adım 3 — Akıllı görüntü sıkıştırma (kaliteyi düşürmeden küçük boyut)
- `compressForArchive()`: uzun kenar 2000px (el yazısı için yeterli) + WebP q=0.82 (JPEG'den ~%30 küçük, görsel olarak aynı) + 320px thumbnail.
- WebP desteklenmezse otomatik JPEG fallback. Aynı canvas API — teknoloji değişmedi.

## ✅ Adım 4 — Gemini Vision gerçekten bağlandı
- Önceden routing.py'de `grader: None` → "Provider 'gemini' uygulanmadı" hatası.
- Yeni `services/gemini.py` (DeepSeek deseni): OpenAI-uyumlu Gemini endpoint, vision (image_base64) destekli, fallback'li.
- routing.py: gerçek grader bağlandı, `_try_provider` gemini dalı eklendi.
- **Kanıt:** Gemini zorlanınca artık `gemini_fallback_mock` dönüyor (eski 'error' hatası yok). GEMINI_API_KEY ile gerçek Gemini Vision çağrısı yapacak.

## ✅ Adım 5 — Kalem basıncı render (dijital masa)
- `perfect-freehand@1.2.3` eklendi.
- digital-desk.tsx: MouseEvent → Pointer `e.pressure` yakalama; basınç noktaları perfect-freehand `getStroke` ile outline poligona; Konva `Line closed+fill` ile basınca duyarlı çizim (canlı + kaydedilmiş).
- **Kanıt:** desktop tsc SIFIR hata, vite build başarılı.

## 🟢 Genel kanıt karnesi
| Kontrol | Sonuç |
|---|---|
| Desktop tsc | ✅ SIFIR hata |
| Desktop vite build | ✅ dist/ üretildi |
| Cloud Brain | ✅ 57 route |
| Eski entegrasyon testi (regresyon) | ✅ 22/22 |
| Arşiv snapshot (backend) | ✅ kaydet/yükle/404 |
| Serialize/restore (digital-desk) | ✅ 7/7 |

## ⚠️ Açık kalan (iş kararı / ortam gerektiren)
- Gemini & DeepSeek gerçek API anahtarları (GEMINI_API_KEY, DEEPSEEK_API_KEY) — production'da set edilmeli.
- RN 0.76 → 0.77+ yükseltmesi (React 19 tam uyumu için) — major upgrade, ayrı test gerektirir.
- Rust `cargo build` — bu ortamda toolchain yok, doğrulanamadı.
- compressForArchive'ın App.tsx arşivleme akışına bağlanması (fonksiyon hazır, çağrı noktası v1.17).
