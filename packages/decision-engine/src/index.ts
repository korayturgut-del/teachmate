/**
 * @doa/decision-engine
 *
 * DECISION ENGINE — Sistemin Beyni.
 * ADR-018: Kademeli zekâ yönlendirme.
 *
 * Tüm grading istekleri önce buradan geçer.
 * "Yerelde mi çözeyim, buluta mı yükselteyim?" kararını verir.
 *
 * FREEZE CHANGE REQUEST onaylı (koşul: grading-engine public API korunur).
 * Bu paket grading-engine'in İÇİNDE çağrılır, dış dünyaya sızmaz.
 */

// ── Tipler ─────────────────────────────────────────────────────

export type QuestionType = 'closed' | 'open'

export type DecisionRoute = 'local_resolve' | 'cloud_escalate' | 'offline_queue'

export interface DecisionContext {
  /** OCR güven skoru (0.0 - 1.0) */
  ocrConfidence: number

  /** Soru tipi — answer-key-engine'den */
  questionType: QuestionType

  /** Öğretmen ID — ADR-016 profili için */
  teacherId: string

  /** İnternet bağlantısı var mı? */
  isOnline: boolean

  /** Sınav ID (event log için) */
  examId: string

  /** Soru numarası (event log için) */
  questionNo: number
}

export interface Decision {
  route: DecisionRoute
  reason: string           // İnsan-okunur gerekçe (audit)
  requiresTeacherReview: boolean  // Kural 12 uyumlu
  estimatedCost: 'free' | 'cloud'
}

export interface TeacherProfile {
  avgDelta: number
  roundsTo: number
  strictness: 'lenient' | 'neutral' | 'strict'
  sampleSize: number
}

// ── Karar Tablosu (Phase 3 — 3 sinyal) ───────────────────────

interface Thresholds {
  ocrHigh: number    // ≥ bu değer → yüksek güven
  ocrMid: number     // ≥ bu değer → orta güven, < bu → düşük
}

const DEFAULT_THRESHOLDS: Thresholds = {
  ocrHigh: 0.95,
  ocrMid: 0.80,
}

/**
 * Öğretmen profiline göre eşikleri ayarla.
 * "Katı" öğretmen → daha çok bulut (eşik yükselir).
 * "Cömert" öğretmen → daha çok yerel (eşik düşer).
 */
function adjustThresholds(
  base: Thresholds,
  profile: TeacherProfile | null,
): Thresholds {
  if (!profile || profile.sampleSize < 10) return base

  // Katı öğretmen: AI'a daha çok güvenmez → elle kontrol ister
  // → eşikleri YÜKSELT (daha çok buluta git)
  if (profile.strictness === 'strict') {
    return {
      ocrHigh: Math.min(0.98, base.ocrHigh + 0.03),
      ocrMid: Math.min(0.88, base.ocrMid + 0.05),
    }
  }

  // Cömert öğretmen: AI'a güvenir → yerelde daha çok çözsün
  if (profile.strictness === 'lenient') {
    return {
      ocrHigh: Math.max(0.90, base.ocrHigh - 0.05),
      ocrMid: Math.max(0.70, base.ocrMid - 0.05),
    }
  }

  return base
}

// ── Ana Karar Fonksiyonu ──────────────────────────────────────

/**
 * Sistemin beyni. Her grading isteği önce buradan geçer.
 *
 * Kademeli zekâ:
 *   1. OCR güveni + soru türü + öğretmen profili → karar
 *   2. Yerel çözüm (answer-key-engine) VEYA bulut (DeepSeek) VEYA kuyruk
 *
 * DeepSeek yalnızca decide() "cloud_escalate" dönerse çağrılır.
 */
export function decide(
  ctx: DecisionContext,
  profile: TeacherProfile | null = null,
): Decision {
  const thresholds = adjustThresholds(DEFAULT_THRESHOLDS, profile)

  // ── İnternet yok → offline kuyruk ──────────────────────────
  if (!ctx.isOnline) {
    return {
      route: 'offline_queue',
      reason: `İnternet bağlantısı yok. OCR güveni: ${(ctx.ocrConfidence * 100).toFixed(0)}%. Kuyruğa alındı (ADR-013).`,
      requiresTeacherReview: true,
      estimatedCost: 'free',
    }
  }

  // ── Yüksek güven + kapalı uçlu → YEREL ────────────────────
  if (ctx.ocrConfidence >= thresholds.ocrHigh && ctx.questionType === 'closed') {
    return {
      route: 'local_resolve',
      reason: `OCR güveni %${(ctx.ocrConfidence * 100).toFixed(0)} ≥ %${(thresholds.ocrHigh * 100).toFixed(0)} ve kapalı uçlu soru. Cevap anahtarıyla yerel eşleştirme yeterli.`,
      requiresTeacherReview: false,
      estimatedCost: 'free',
    }
  }

  // ── Yüksek güven + açık uçlu → BULUT ──────────────────────
  if (ctx.ocrConfidence >= thresholds.ocrHigh && ctx.questionType === 'open') {
    return {
      route: 'cloud_escalate',
      reason: `OCR güveni yüksek (%${(ctx.ocrConfidence * 100).toFixed(0)}) ama açık uçlu soru — DeepSeek anlam analizi gerekli.`,
      requiresTeacherReview: false,
      estimatedCost: 'cloud',
    }
  }

  // ── Orta güven + kapalı uçlu → YEREL + onay ───────────────
  if (ctx.ocrConfidence >= thresholds.ocrMid && ctx.questionType === 'closed') {
    return {
      route: 'local_resolve',
      reason: `OCR güveni orta (%${(ctx.ocrConfidence * 100).toFixed(0)}). Kapalı uçlu — yerel eşleştirme dene, öğretmen onayı öner.`,
      requiresTeacherReview: true,
      estimatedCost: 'free',
    }
  }

  // ── Orta güven + açık uçlu → BULUT ────────────────────────
  if (ctx.ocrConfidence >= thresholds.ocrMid && ctx.questionType === 'open') {
    return {
      route: 'cloud_escalate',
      reason: `OCR güveni orta (%${(ctx.ocrConfidence * 100).toFixed(0)}) ve açık uçlu soru — DeepSeek gerekiyor.`,
      requiresTeacherReview: ctx.ocrConfidence < 0.85,
      estimatedCost: 'cloud',
    }
  }

  // ── Düşük güven (her tür) → BULUT + zorunlu onay ──────────
  return {
    route: 'cloud_escalate',
    reason: `OCR güveni düşük (%${(ctx.ocrConfidence * 100).toFixed(0)} < %${(thresholds.ocrMid * 100).toFixed(0)}). Bulut AI + öğretmen onayı zorunlu (Kural 12).`,
    requiresTeacherReview: true,
    estimatedCost: 'cloud',
  }
}

// ── İstatistik ────────────────────────────────────────────────

export interface DecisionStats {
  total: number
  localResolved: number
  cloudEscalated: number
  offlineQueued: number
  localPercentage: number
}

let stats: DecisionStats = {
  total: 0, localResolved: 0, cloudEscalated: 0,
  offlineQueued: 0, localPercentage: 0,
}

export function trackDecision(decision: Decision): void {
  stats.total++
  if (decision.route === 'local_resolve') stats.localResolved++
  else if (decision.route === 'cloud_escalate') stats.cloudEscalated++
  else stats.offlineQueued++
  stats.localPercentage = Math.round(
    ((stats.localResolved + stats.offlineQueued) / stats.total) * 100
  )
}

export function getDecisionStats(): Readonly<DecisionStats> {
  return { ...stats }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — GENİŞLETİLMİŞ YÖNLENDİRME (ChatGPT çok-katmanlı mimari)
// ADR-018 "Phase 4 platform OCR" hedefi.
//
// Mevcut decide() KORUNUR (grading-engine onu çağırıyor — Madde 1).
// Bu katman onun üstüne kurulur: "buluta gidilecekse HANGİ AI'a?" +
// "hangi cihazda HANGİ OCR motoru?" kararlarını ekler.
// ═══════════════════════════════════════════════════════════════

/** Çalıştığımız platform — OCR motor seçimini belirler. */
export type Platform = 'android' | 'ios' | 'desktop'

/** Belgenin içerik türü — belge analizi katmanından gelir. */
export type ContentType =
  | 'printed'        // basılı metin (form, başlık, öğrenci no)
  | 'handwriting'    // düz Türkçe el yazısı
  | 'math'           // matematik işlemi / formül
  | 'composition'    // uzun Türkçe kompozisyon / açık uçlu
  | 'diagram'        // grafik, şekil, çizim

/** Cihazda kullanılacak yerel OCR motoru. */
export type OcrEngine =
  | 'mlkit'          // Android — ML Kit Text Recognition v2 (TR destekli)
  | 'apple_vision'   // iOS/iPadOS — Apple Vision OCR
  | 'paddle_onnx'    // Desktop — PaddleOCR ONNX (segment başına)

/** Buluta gidilirse hangi AI sağlayıcı. */
export type AIProvider = 'deepseek' | 'gemini_vision' | 'none'

/** Belge analizi çıktısı — Decision Engine'in girdisi. */
export interface DocumentAnalysis {
  contentType: ContentType
  ocrConfidence: number      // 0.0 - 1.0
  /** İçerikte görsel öğe var mı? (grafik/şekil → Gemini Vision) */
  hasVisualElements: boolean
}

/** Genişletilmiş karar — temel decide() + platform + AI seçimi. */
export interface RoutingDecision extends Decision {
  /** Cihazda kullanılacak OCR motoru (KADEME 0). */
  ocrEngine: OcrEngine
  /** Buluta gidilirse hangi AI sağlayıcı (KADEME 2). */
  aiProvider: AIProvider
  contentType: ContentType
}

/**
 * Platforma göre yerel OCR motoru seç (KADEME 0 — her zaman cihazda).
 * "Önce cihaz" felsefesi: OCR asla buluta gitmez, sadece anlamsal değerlendirme gider.
 */
export function selectOcrEngine(platform: Platform): OcrEngine {
  switch (platform) {
    case 'android': return 'mlkit'
    case 'ios':     return 'apple_vision'
    case 'desktop': return 'paddle_onnx'
  }
}

/**
 * Buluta gidilecekse hangi AI sağlayıcı? (ChatGPT yönlendirme tablosu)
 *
 *   Basılı + yüksek güven        → none (yerelde çözülür)
 *   Kompozisyon / açık uçlu      → DeepSeek (anlam analizi)
 *   Matematik / grafik / şekil   → Gemini Vision (görsel akıl)
 *   Çok kötü el yazısı (düşük)   → Gemini Vision + öğretmen
 */
export function selectAIProvider(analysis: DocumentAnalysis): AIProvider {
  // Görsel öğe veya matematik/diyagram → Gemini Vision (görsel muhakeme)
  if (analysis.hasVisualElements ||
      analysis.contentType === 'math' ||
      analysis.contentType === 'diagram') {
    return 'gemini_vision'
  }
  // Çok düşük güvenli el yazısı → Gemini Vision (en güçlü el yazısı modeli)
  if (analysis.contentType === 'handwriting' && analysis.ocrConfidence < 0.55) {
    return 'gemini_vision'
  }
  // Kompozisyon / açık uçlu metin → DeepSeek (dil/anlam)
  if (analysis.contentType === 'composition') {
    return 'deepseek'
  }
  // Geri kalan açık uçlu → DeepSeek
  return 'deepseek'
}

/**
 * ANA YÖNLENDİRME — ChatGPT çok-katmanlı mimari.
 *
 *   Öğretmen Foto/Tarama
 *        ↓
 *   Belge Analizi (DocumentAnalysis)
 *        ↓
 *   Decision Engine (bu fonksiyon)
 *        ↓
 *   En uygun teknoloji seçilir (OCR motoru + rota + AI sağlayıcı)
 *
 * Mevcut decide()'ı çağırır (rota + onay), üstüne platform OCR ve AI seçimi ekler.
 */
export function route(
  platform: Platform,
  analysis: DocumentAnalysis,
  ctx: Omit<DecisionContext, 'ocrConfidence' | 'questionType'>,
  profile: TeacherProfile | null = null,
): RoutingDecision {
  // contentType → questionType eşlemesi (mevcut decide() için)
  const questionType: QuestionType =
    analysis.contentType === 'printed' ? 'closed' : 'open'

  // KADEME 1 — temel karar (mevcut, korunmuş mantık)
  const base = decide(
    { ...ctx, ocrConfidence: analysis.ocrConfidence, questionType },
    profile,
  )

  // KADEME 0 — platform OCR motoru (her zaman cihazda)
  const ocrEngine = selectOcrEngine(platform)

  // KADEME 2 — buluta gidiliyorsa AI sağlayıcı seç, yoksa none
  const aiProvider: AIProvider =
    base.route === 'cloud_escalate' ? selectAIProvider(analysis) : 'none'

  return {
    ...base,
    ocrEngine,
    aiProvider,
    contentType: analysis.contentType,
  }
}
