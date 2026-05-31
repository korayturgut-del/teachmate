/**
 * apps/mobile/src/lib/ocr-bridge.ts
 *
 * v1.13 — Gerçek OCR Pipeline Köprüsü
 *
 * react-native-vision-camera-text-recognition → decision-engine zinciri.
 * Master prompt: "do NOT write a new native bridge — this maintained
 * package exists". Bu dosya o paketin API'sini kullanır, native bridge yazmaz.
 *
 * Akış:
 *   Fotoğraf URI → [ocr-plus ML Kit] → OCRResult
 *               → [decision-engine.decide()] → route
 *               → local_resolve: answer-key eşleştirme
 *               → cloud_escalate: Cloud Brain API
 *               → offline_queue: yerel kuyruk
 *
 * Cihaz seçimi (master prompt ADR-019):
 *   Android → ML Kit Text Recognition v2 (ocr-plus içinde)
 *   iOS     → Apple Vision Framework (ocr-plus içinde, iOS ≥ 16)
 */

// react-native-vision-camera-text-recognition tipleri
// Paket henüz yüklü olmadığı için tip stub'ları — gerçek paket kurulunca
// import { scanOCR } from 'react-native-vision-camera-text-recognition' kullanılır
export interface OCRWord {
  text: string
  confidence: number           // 0.0 - 1.0 (ML Kit güveni)
  boundingBox: {
    x: number; y: number
    width: number; height: number
  }
}

export interface OCRBlock {
  text: string
  lines: Array<{ text: string; words: OCRWord[] }>
  confidence: number
}

export interface OCRFrame {
  blocks: OCRBlock[]
  /** Tüm tespit edilen metin (concat) */
  text: string
  /** Ortalama güven skoru */
  confidence: number
}

// ── Decision Engine Tipleri (workspace import yerine inline stub) ─────
// Gerçek projede: import { decide, DecisionContext } from '@doa/decision-engine'
export type DecisionRoute = 'local_resolve' | 'cloud_escalate' | 'offline_queue'

export interface OcrDecision {
  route: DecisionRoute
  reason: string
  requiresTeacherReview: boolean
  estimatedCost: 'free' | 'cloud'
}

// ── OCR Sonuç Tipi ────────────────────────────────────────────────────

export interface MobileOcrResult {
  /** Tüm tespit edilen metin */
  rawText: string
  /** Bölge bazlı metin (segmentasyon için) */
  blocks: OCRBlock[]
  /** OCR ortalama güveni (0-1) — decision-engine girdisi */
  confidence: number
  /** Kullanılan motor */
  engine: 'mlkit' | 'apple_vision'
  /** İşlem süresi (ms) */
  durationMs: number
}

export interface PipelineResult {
  ocr: MobileOcrResult
  decision: OcrDecision
  /** QR payload (varsa) — exam_id + template_version (ADR-015) */
  qrPayload?: string
  /** Soru bölgeleri (varsa — şablon bazlı) */
  questionRegions?: Array<{
    questionNo: number
    text: string
    confidence: number
  }>
}

// ── Platform Tespit ───────────────────────────────────────────────────

import { Platform } from 'react-native'

export function detectOcrEngine(): 'mlkit' | 'apple_vision' {
  return Platform.OS === 'ios' ? 'apple_vision' : 'mlkit'
}

// ── OCR Çalıştırıcı ───────────────────────────────────────────────────

/**
 * Fotoğraftan OCR çalıştırır.
 *
 * Gerçek implement: scanOCR('react-native-vision-camera-text-recognition') kullanır.
 * Bu paket ML Kit (Android) / Apple Vision (iOS) platformunu otomatik seçer.
 * Master prompt: "do NOT write a new native bridge — this maintained package exists"
 */
export async function runMobileOcr(
  photoUri: string,
  /** Türkçe karakter desteği zorunlu (madde 5) */
  lang: 'tr' | 'tr-latin' = 'tr',
): Promise<MobileOcrResult> {
  const engine = detectOcrEngine()
  const t0 = Date.now()

  try {
    // Gerçek çağrı (react-native-vision-camera-text-recognition kurulunca aktif):
    // const { scanOCR } = await import('react-native-vision-camera-text-recognition')
    // const frame = await scanOCR(photoUri, { language: lang })

    // v1.13 stub — paket yüklü değilken tip-güvenli fallback
    // Gerçek cihazda paket kurulunca bu satır kaldırılır:
    const frame = await _stubOcrResult(photoUri)

    const confidence = frame.confidence ?? computeAvgConfidence(frame.blocks)

    return {
      rawText: frame.text,
      blocks: frame.blocks,
      confidence,
      engine,
      durationMs: Date.now() - t0,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`OCR başarısız (${engine}): ${message}`)
  }
}

/** Blok listesinden ortalama güven hesapla */
function computeAvgConfidence(blocks: OCRBlock[]): number {
  if (blocks.length === 0) return 0
  const sum = blocks.reduce((s, b) => s + b.confidence, 0)
  return sum / blocks.length
}

// ── Decision Engine Karar Fonksiyonu ─────────────────────────────────

/**
 * OCR sonucunu decision-engine'e verir, route belirler.
 * Gerçek projede: import { decide } from '@doa/decision-engine'
 */
export function decideRoute(
  ocr: MobileOcrResult,
  context: {
    questionType: 'closed' | 'open'
    teacherId: string
    isOnline: boolean
    examId: string
    questionNo: number
  },
): OcrDecision {
  // Karar tablosu (ADR-018, master prompt routing table):
  //   printed, conf ≥ 0.95 → local_resolve, no AI
  //   composition / open text → cloud: DeepSeek
  //   poor handwriting < 0.55 → cloud: Gemini Vision + review
  //   offline → offline_queue

  if (!context.isOnline) {
    return {
      route: 'offline_queue',
      reason: 'İnternet bağlantısı yok — ADR-013 kuyruğuna eklendi',
      requiresTeacherReview: false,
      estimatedCost: 'free',
    }
  }

  if (ocr.confidence >= 0.95 && context.questionType === 'closed') {
    return {
      route: 'local_resolve',
      reason: `Yüksek güven (${(ocr.confidence * 100).toFixed(0)}%) + kapalı uçlu → yerel`,
      requiresTeacherReview: false,
      estimatedCost: 'free',
    }
  }

  if (ocr.confidence < 0.55) {
    return {
      route: 'cloud_escalate',
      reason: `Düşük güven (${(ocr.confidence * 100).toFixed(0)}%) → Gemini Vision + öğretmen incelemesi`,
      requiresTeacherReview: true,
      estimatedCost: 'cloud',
    }
  }

  return {
    route: 'cloud_escalate',
    reason: `Açık uçlu veya orta güven → DeepSeek değerlendirmesi`,
    requiresTeacherReview: ocr.confidence < 0.70,
    estimatedCost: 'cloud',
  }
}

// ── QR Tespit (ADR-015) ────────────────────────────────────────────────

/**
 * OCR metninde ADR-015 QR payload'ı ara.
 * Kamera ile barcode tarama: react-native-vision-camera-text-recognition kullanır.
 * OCR metninde de "eXXXX-vN" pattern'i aranır (fallback).
 */
export function extractQrFromOcrText(rawText: string): string | undefined {
  // Format: "eXXXX-vN" veya "exam=XXXX&version=N"
  const dashV = rawText.match(/\b([a-z0-9-]+-v\d+)\b/i)
  if (dashV) return dashV[1]

  const query = rawText.match(/exam=([^&\s]+)&version=(\d+)/)
  if (query) return `exam=${query[1]}&version=${query[2]}`

  return undefined
}

// ── Tam Pipeline ──────────────────────────────────────────────────────

/**
 * Mobil sınav kağıdı okuma pipeline'ı — tek çağrı.
 *
 * 1. OCR çalıştır (ML Kit / Apple Vision)
 * 2. QR payload'ı bul (ADR-015)
 * 3. Decision Engine ile route belirle
 * 4. Sonuç döndür (UI QuickReview'a gider)
 */
export async function runMobilePipeline(
  photoUri: string,
  context: {
    questionType?: 'closed' | 'open'
    teacherId: string
    isOnline: boolean
    examId: string
    questionNo?: number
  },
): Promise<PipelineResult> {
  // 1. OCR
  const ocr = await runMobileOcr(photoUri)

  // 2. QR tespit (ADR-015 — exam_id + template_version)
  const qrPayload = extractQrFromOcrText(ocr.rawText)

  // 3. Decision Engine
  const decision = decideRoute(ocr, {
    questionType: context.questionType ?? 'open',
    teacherId: context.teacherId,
    isOnline: context.isOnline,
    examId: context.examId,
    questionNo: context.questionNo ?? 1,
  })

  return { ocr, decision, qrPayload }
}

// ── OCR Düzeltme Kaydı (v1.11 learning-engine entegrasyonu) ──────────

/**
 * Öğretmen OCR hatasını düzelttiğinde learning-engine'e bildir.
 * Gerçek projede: import { LearningEngine } from '@doa/learning-engine'
 */
export interface CorrectionInput {
  ocrText: string
  correctedText: string
  engine: 'mlkit' | 'apple_vision'
  ocrConfidence: number
  contentType: 'handwriting' | 'printed' | 'math'
  teacherId: string
  consentToTrain: boolean
}

/** v1.11'deki LearningEngine.recordCorrection'a iletilecek veriyi formatlar */
export function formatCorrectionForLearning(input: CorrectionInput) {
  return {
    ocrText: input.ocrText,
    correctedText: input.correctedText,
    engine: input.engine,
    ocrConfidence: input.ocrConfidence,
    contentType: input.contentType,
    teacherId: input.teacherId,
    consentToTrain: input.consentToTrain,
  }
}

// ── ADR-011: QR Oturum Köprüsü ────────────────────────────────────────

/**
 * Mobil oturumunu QR köprüsü ile masaüstüne devreder (ADR-011).
 * sync-engine'in SyncEngine.createOutgoingPayload() + splitForQr() kullanır.
 *
 * Akış:
 *   1. Öğretmen mobilde N kağıt okur
 *   2. "Masaüstüne Gönder" butonuna basar
 *   3. Bu fonksiyon sync payload oluşturur → QR parçalarına böler
 *   4. Her QR ekranda gösterilir, masaüstü kamera ile okur
 *   5. Masaüstü SyncEngine.applyIncomingPayload() → Event Store'a yazar
 */
export interface QrBridgeSession {
  /** QR kare dizisi (çok-kareli — her biri ayrı gösterilir) */
  qrChunks: string[]
  /** Toplam kare sayısı */
  totalChunks: number
  /** Oturum anahtarı — masaüstüne ayrı iletilmeli (güvenli kanal) */
  sessionKey: string
  /** Kaç olay taşınıyor */
  eventCount: number
}

/**
 * Mobil oturumundan QR köprüsü yükü oluşturur.
 * sync-engine'in SyncEngine.createOutgoingPayload() + splitForQr() kullanır.
 * Gerçek projede: import { SyncEngine } from '@doa/sync-engine'
 */
export async function createQrBridgeSession(
  events: Array<{ eventType: string; aggregate: string; payload: Record<string, unknown> }>,
  sessionKey: string,
  /** fetch veya custom encrypt fn */
  encrypt: (data: string, key: string) => Promise<{ ciphertext: string; nonce: string }>,
  sha256: (data: string) => Promise<string>,
): Promise<QrBridgeSession> {
  const plaintext = JSON.stringify(events)
  const { ciphertext, nonce } = await encrypt(plaintext, sessionKey)
  const checksum = await sha256(plaintext)

  const payload = {
    version: '1.0-doa' as const,
    sessionId: `mobile_${Date.now()}`,
    direction: 'mobile_to_desktop' as const,
    encryptedEvents: ciphertext,
    nonce,
    checksum,
    itemCount: events.length,
  }

  // QR_CHUNK_BYTES: 1800 (sync-engine sabiti)
  const full = JSON.stringify(payload)
  const CHUNK = 1800
  const chunks: string[] = []
  const total = Math.ceil(full.length / CHUNK)
  for (let i = 0; i < total; i++) {
    const slice = full.slice(i * CHUNK, (i + 1) * CHUNK)
    chunks.push(`DOA-SYNC|${i + 1}/${total}|${slice}`)
  }

  return {
    qrChunks: chunks,
    totalChunks: total,
    sessionKey,
    eventCount: events.length,
  }
}

// ── Stub OCR (test / paket yüklü değilken) ───────────────────────────

async function _stubOcrResult(photoUri: string): Promise<OCRFrame> {
  // Gerçek paketi simüle eder — paket kurulunca BU FONKSİYON SİLİNİR
  await new Promise(r => setTimeout(r, 400 + Math.random() * 600))
  return {
    text: 'Türkçe el yazısı metni — stub. Gerçek ML Kit paketi kurulunca değişecek.',
    confidence: 0.72 + Math.random() * 0.25,
    blocks: [
      {
        text: 'Soru 1 yanıtı',
        confidence: 0.88,
        lines: [{ text: 'Soru 1 yanıtı', words: [
          { text: 'Soru', confidence: 0.92, boundingBox: { x: 10, y: 10, width: 60, height: 20 } },
          { text: '1', confidence: 0.95, boundingBox: { x: 75, y: 10, width: 15, height: 20 } },
        ]}],
      },
    ],
  }
}
