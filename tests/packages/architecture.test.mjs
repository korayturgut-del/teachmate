// ChatGPT çok-katmanlı mimari — davranış testleri
import { route, selectOcrEngine, selectAIProvider, decide } from '../../dist-test/decision-engine/src/index.js'
import { pickLocalEngine, analyzeDocument } from '../../dist-test/ocr-engine/src/index.js'
import { segment, segmentAuto, bboxToPixels } from '../../dist-test/question-segmentation/src/index.js'
import { LearningEngine, normalizeTr } from '../../dist-test/learning-engine/src/index.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log('  ✅', name) }
  else { fail++; console.log('  ❌', name) }
}

async function main() {
  const baseCtx = { teacherId: 't1', isOnline: true, examId: 'e1', questionNo: 1 }

  // ── PLATFORM OCR SEÇİMİ ───────────────────────────────────
  console.log('\n[platform OCR motoru — KADEME 0]')
  check('Android → ML Kit', selectOcrEngine('android') === 'mlkit')
  check('iOS → Apple Vision', selectOcrEngine('ios') === 'apple_vision')
  check('Desktop → PaddleOCR ONNX', selectOcrEngine('desktop') === 'paddle_onnx')
  check('ocr-engine pickLocalEngine tutarlı', pickLocalEngine('android') === 'mlkit')

  // ── ChatGPT YÖNLENDİRME TABLOSU ───────────────────────────
  console.log('\n[Decision Engine — ChatGPT tablosu]')

  // Basılı + yüksek güven → yerelde çöz, AI yok
  const r1 = route('desktop', { contentType: 'printed', ocrConfidence: 0.97, hasVisualElements: false }, baseCtx)
  check('Basılı %97 → yerel çöz, AI=none', r1.route === 'local_resolve' && r1.aiProvider === 'none')

  // Türkçe kompozisyon → DeepSeek
  const r2 = route('android', { contentType: 'composition', ocrConfidence: 0.90, hasVisualElements: false }, baseCtx)
  check('Kompozisyon → bulut + DeepSeek', r2.route === 'cloud_escalate' && r2.aiProvider === 'deepseek')

  // Matematik işlemi → Gemini Vision
  const r3 = route('ios', { contentType: 'math', ocrConfidence: 0.88, hasVisualElements: false }, baseCtx)
  check('Matematik → bulut + Gemini Vision', r3.route === 'cloud_escalate' && r3.aiProvider === 'gemini_vision')

  // Grafik/şekil → Gemini Vision
  const r4 = route('desktop', { contentType: 'diagram', ocrConfidence: 0.85, hasVisualElements: true }, baseCtx)
  check('Grafik/şekil → Gemini Vision', r4.aiProvider === 'gemini_vision')

  // Çok kötü el yazısı (düşük güven) → Gemini Vision + öğretmen onayı
  const r5 = route('android', { contentType: 'handwriting', ocrConfidence: 0.40, hasVisualElements: false }, baseCtx)
  check('Kötü el yazısı %40 → Gemini Vision + review', r5.aiProvider === 'gemini_vision' && r5.requiresTeacherReview)

  // İnternet yok → offline kuyruk (rota), AI çağrılmaz
  const r6 = route('android', { contentType: 'composition', ocrConfidence: 0.90, hasVisualElements: false }, { ...baseCtx, isOnline: false })
  check('İnternet yok → offline kuyruk, AI=none', r6.route === 'offline_queue' && r6.aiProvider === 'none')

  // Platform OCR motoru her kararda doğru
  check('Karar platform OCR motorunu taşıyor', r1.ocrEngine === 'paddle_onnx' && r2.ocrEngine === 'mlkit' && r3.ocrEngine === 'apple_vision')

  // Mevcut decide() hâlâ çalışıyor (regresyon — Madde 1)
  const legacy = decide({ ocrConfidence: 0.97, questionType: 'closed', teacherId: 't1', isOnline: true, examId: 'e1', questionNo: 1 })
  check('REGRESYON: eski decide() korundu', legacy.route === 'local_resolve')

  // ── BELGE ANALİZİ ─────────────────────────────────────────
  console.log('\n[belge analizi]')
  const printedOcr = { text: 'Ad Soyad: Numara:', confidence: 0.97, wordCount: 4, lines: [{text:'a',confidence:0.97}], provider: 'paddleocr', latencyMs: 10 }
  check('basılı tespit (yüksek güven, az satır)', analyzeDocument(printedOcr).contentType === 'printed')
  const mathOcr = { text: '2x + 3 = 7 → x = (7-3)/2 = 2', confidence: 0.8, wordCount: 5, lines: [{text:'a',confidence:0.8}], provider: 'paddleocr', latencyMs: 10 }
  check('matematik tespit (sembol yoğun)', analyzeDocument(mathOcr).contentType === 'math')
  const diagramAnalysis = analyzeDocument(printedOcr, { hasVisualElements: true })
  check('görsel öğe → diagram', diagramAnalysis.contentType === 'diagram')

  // ── SORU SEGMENTASYONU (eksik katman) ─────────────────────
  console.log('\n[question-segmentation]')
  const tmplResult = segment(800, 1000, {
    templateQuestions: [
      { questionNo: 1, bbox: [0, 0, 200, 1000], maxScore: 10 },
      { questionNo: 2, bbox: [220, 0, 450, 1000], maxScore: 10 },
    ],
  })
  check('şablon tabanlı: 2 soru kutusu', tmplResult.regions.length === 2 && tmplResult.method === 'template')

  // Otomatik: 2 soru, aralarında büyük boşluk
  const lines = [
    { bbox: [10, 0, 30, 500] }, { bbox: [35, 0, 55, 500] },   // soru 1 (yakın satırlar)
    { bbox: [200, 0, 220, 500] }, { bbox: [225, 0, 245, 500] }, // soru 2 (büyük boşluk sonrası)
  ]
  const autoResult = segmentAuto(lines, 800, 1000)
  check('otomatik: boşluğa göre 2 gruba ayırdı', autoResult.regions.length === 2 && autoResult.method === 'auto')

  const px = bboxToPixels([0, 0, 500, 1000], 800, 1000)
  check('bbox → piksel dönüşümü', px.width === 800 && px.height === 500)

  // ── ÖĞRENME MOTORU (vizyon kalbi) ─────────────────────────
  console.log('\n[learning-engine — öğretmen düzeltmesinden öğrenme]')
  check('TR normalize (İ/I)', normalizeTr('KÖPRÜ İLE') === 'köprü ile')

  const dict = new Map()
  const uploads = []
  const corpus = { totalSamples: 0, byEngine: {}, byContentType: {}, newSinceLastTrain: 0 }
  const store = {
    getDictEntry: async (w, ct) => dict.get(w + '|' + ct) ?? null,
    upsertDictEntry: async (e) => dict.set(e.wrong + '|' + e.contentType, e),
    queueForUpload: async (c) => { uploads.push(c); corpus.totalSamples++; corpus.newSinceLastTrain++ },
    corpusStats: async () => ({ ...corpus, readyToTrain: false }),
  }
  const events = []
  const learn = new LearningEngine(store, (e, p) => events.push({ e, p }))

  // Öğretmen "köprü" yerine okunan "köpek"i düzeltir
  await learn.recordCorrection({ ocrText: 'köpek', correctedText: 'köprü', engine: 'paddle_onnx', ocrConfidence: 0.6, contentType: 'handwriting', teacherId: 't1' })
  check('düzeltme bulut kuyruğuna eklendi', uploads.length === 1)
  check('OCRCorrection event üretildi', events.some(x => x.e === 'OCRCorrection'))

  // Aynı düzeltme 2. kez → sözlük count=2 → güvenle uygulanır
  await learn.recordCorrection({ ocrText: 'köpek', correctedText: 'köprü', engine: 'paddle_onnx', ocrConfidence: 0.6, contentType: 'handwriting', teacherId: 't1' })
  const applied = await learn.applyLearnedCorrections('köpek', 'handwriting')
  check('öğrenilen düzeltme anında uygulandı (köpek→köprü)', applied.applied && applied.text === 'köprü')

  // Henüz öğrenilmemiş kelime → değişmez
  const notLearned = await learn.applyLearnedCorrections('masa', 'handwriting')
  check('öğrenilmemiş kelime değişmez', !notLearned.applied && notLearned.text === 'masa')

  // KVKK: onay yoksa buluta gitmez
  const before = uploads.length
  await learn.recordCorrection({ ocrText: 'x', correctedText: 'y', engine: 'mlkit', ocrConfidence: 0.5, contentType: 'handwriting', teacherId: 't1', consentToTrain: false })
  check('KVKK: onaysız örnek buluta GİTMEZ', uploads.length === before)

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('TEST HATASI:', e); process.exit(1) })
