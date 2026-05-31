/**
 * @doa/ocr-engine
 *
 * OCR Soyutlama Katmanı — Tesseract WASM → PaddleOCR ONNX.
 * Phase 1-2: Tesseract WASM (client-side).
 * Phase 3: PaddleOCR API (Cloud Brain).
 * Phase 4: PaddleOCR ONNX yerel (native binding).
 */

// ── Tipler ─────────────────────────────────────────────────────

export interface OCRResult {
  text: string
  confidence: number
  wordCount: number
  lines: Array<{ text: string; confidence: number; bbox?: number[] }>
  provider: 'tesseract' | 'paddleocr' | 'mock'
  latencyMs: number
}

export interface StudentInfo {
  studentName: string | null
  studentNo: string | null
  className: string | null
  school: string | null
  ocrConfidence: number
}

// ── Görüntü Ön İşleme (Kaynak B'den port) ────────────────────

/**
 * Auto-contrast — histogram stretching.
 * Kaynak B: Modules.imagePrep.autoContrast
 */
export function autoContrast(
  imageData: ImageData,
  clipPercent = 0.5,
): ImageData {
  const data = imageData.data
  const histogram = new Array(256).fill(0)
  const totalPixels = imageData.width * imageData.height

  // Histogram oluştur
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    )
    histogram[gray]++
  }

  // Clip limits
  const clipCount = (clipPercent / 100) * totalPixels
  let low = 0, high = 255
  let cumSum = 0
  while (cumSum < clipCount && low < 255) cumSum += histogram[low++]
  cumSum = 0
  while (cumSum < clipCount && high > 0) cumSum += histogram[high--]

  // Stretch
  const scale = 255 / (high - low || 1)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.max(0, Math.min(255,
        Math.round((data[i + c] - low) * scale)
      ))
    }
  }

  return imageData
}

/** 3×3 medyan denoise — tuz-biber gürültüsü temizleme */
export function denoise3x3(imageData: ImageData): ImageData {
  const { width, height, data } = imageData
  const result = new Uint8ClampedArray(data)
  const get = (x: number, y: number, c: number) =>
    data[(y * width + x) * 4 + c] || 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const neighbors = [
          get(x - 1, y - 1, c), get(x, y - 1, c), get(x + 1, y - 1, c),
          get(x - 1, y, c), get(x, y, c), get(x + 1, y, c),
          get(x - 1, y + 1, c), get(x, y + 1, c), get(x + 1, y + 1, c),
        ].sort((a, b) => a - b)
        result[(y * width + x) * 4 + c] = neighbors[4] // median
      }
    }
  }

  return new ImageData(result, width, height)
}

/** Gri tonlamaya çevir */
export function toGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    )
    data[i] = data[i + 1] = data[i + 2] = gray
  }
  return imageData
}

// ── OCR Engine ────────────────────────────────────────────────

export class OCREngine {
  private cloudBrainUrl: string

  constructor(cloudBrainUrl = 'http://localhost:8000') {
    this.cloudBrainUrl = cloudBrainUrl
  }

  /** Görüntüden metin çıkar */
  async extractText(
    imageDataUrl: string,
    fast = true,
  ): Promise<OCRResult> {
    const startTime = Date.now()
    const base64 = imageDataUrl.includes('base64,')
      ? imageDataUrl.split('base64,')[1]
      : imageDataUrl

    try {
      const res = await fetch(
        `${this.cloudBrainUrl}/api/ocr/extract-text`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64, fast }),
        }
      )
      const data = await res.json()
      return {
        text: data.text,
        confidence: data.confidence,
        wordCount: data.word_count,
        lines: data.lines || [],
        provider: data.provider || 'paddleocr',
        latencyMs: Date.now() - startTime,
      }
    } catch {
      // Tesseract WASM fallback?
      return {
        text: '',
        confidence: 0,
        wordCount: 0,
        lines: [],
        provider: 'mock',
        latencyMs: Date.now() - startTime,
      }
    }
  }

  /** Öğrenci bilgisi çıkar */
  async extractStudentInfo(
    imageDataUrl: string,
  ): Promise<StudentInfo> {
    const base64 = imageDataUrl.includes('base64,')
      ? imageDataUrl.split('base64,')[1]
      : imageDataUrl

    try {
      const res = await fetch(
        `${this.cloudBrainUrl}/api/ocr/extract-student-info`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64, fast: true }),
        }
      )
      return await res.json()
    } catch {
      return {
        studentName: null, studentNo: null,
        className: null, school: null, ocrConfidence: 0,
      }
    }
  }

  /** Görüntü ön işleme zinciri */
  preprocess(imageData: ImageData): ImageData {
    let result = toGrayscale(imageData)
    result = autoContrast(result, 0.5)
    result = denoise3x3(result)
    return result
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — PLATFORM OCR KATMANI (ChatGPT çok-katmanlı mimari)
//
// Her platform kendi en güçlü YEREL motorunu kullanır (önce cihaz):
//   Android → ML Kit Document Scanner + Text Recognition v2
//   iOS     → VisionKit + Apple Vision OCR
//   Desktop → ADF → Rust PDF → QR → Question Segmentation → PaddleOCR ONNX
// ═══════════════════════════════════════════════════════════════

export type OcrPlatform = 'android' | 'ios' | 'desktop'

export type LocalOcrEngine = 'mlkit' | 'apple_vision' | 'paddle_onnx'

/** Belge analizi sonucu — Decision Engine'e beslenir. */
export interface DocAnalysis {
  contentType: 'printed' | 'handwriting' | 'math' | 'composition' | 'diagram'
  ocrConfidence: number
  hasVisualElements: boolean
  /** Kaç ayrı metin bloğu / soru alanı bulundu */
  regionCount: number
}

/**
 * Platforma göre yerel OCR motorunu seç.
 * Bu motor CİHAZDA çalışır — OCR asla buluta gitmez (Madde 4).
 */
export function pickLocalEngine(platform: OcrPlatform): LocalOcrEngine {
  switch (platform) {
    case 'android': return 'mlkit'
    case 'ios':     return 'apple_vision'
    case 'desktop': return 'paddle_onnx'
  }
}

/**
 * Yerel OCR sonucundan belge analizi üret.
 *
 * Heuristikler (cihazda, ücretsiz):
 *  - Çok yüksek güven + düzenli satırlar → basılı (printed)
 *  - Matematik sembolleri yoğun → math
 *  - Uzun, çok satırlı metin → composition
 *  - Düşük güven + düzensiz → handwriting
 *  - hasVisualElements dışarıdan (layout analizi) gelir
 */
export function analyzeDocument(
  ocr: OCRResult,
  opts: { hasVisualElements?: boolean } = {},
): DocAnalysis {
  const conf = ocr.confidence
  const text = ocr.text ?? ''
  const lineCount = ocr.lines?.length ?? 0
  const hasVisualElements = opts.hasVisualElements ?? false

  // Matematik yoğunluğu: sembol oranı
  const mathSymbols = (text.match(/[=+\-×÷*/^√∫∑πΔ()<>]/g) ?? []).length
  const mathRatio = text.length > 0 ? mathSymbols / text.length : 0

  let contentType: DocAnalysis['contentType']
  if (hasVisualElements) {
    contentType = 'diagram'
  } else if (mathRatio > 0.08) {
    contentType = 'math'
  } else if (conf >= 0.95 && lineCount <= 5) {
    contentType = 'printed'
  } else if (text.length > 200 && lineCount >= 4) {
    contentType = 'composition'
  } else {
    contentType = 'handwriting'
  }

  return {
    contentType,
    ocrConfidence: conf,
    hasVisualElements,
    regionCount: Math.max(lineCount, 1),
  }
}
