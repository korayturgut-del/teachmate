/**
 * @doa/answer-key-engine
 *
 * Cevap Anahtarı Yönetim Motoru — AI grading'in çekirdek bağımlılığı.
 *
 * Phase 2.5: Veri modeli + API arayüzü.
 * Phase 3: Gerçek implement (AI grading + deepseek.py ile entegre).
 *
 * FREEZE CHANGE REQUEST: ADR-017 ile onaylandı (düşük risk).
 * Mevcut hiçbir paket API'sini, event'i veya tabloyu değiştirmez.
 */

// ── Tipler ─────────────────────────────────────────────────────

export interface AnswerKeyEntry {
  id?: string
  exam_id: string
  template_version: number
  question_no: number
  max_score: number
  correct_answer?: string
  alternatives?: string[]     // ["dört", "4", "IV"]
  rubric_json?: RubricEntry[]
  partial_credit_rules?: PartialCreditRule[]
  created_at?: string
}

export interface RubricEntry {
  criterion: string          // "Birim çevirme doğru yapılmış"
  points: number             // Bu kritere verilecek puan
  required: boolean          // Zorunlu mu?
}

export interface PartialCreditRule {
  condition: string          // "Sonuç doğru ama işlem adımı eksik"
  percentage: number         // 0.0 - 1.0 arası, max_score'un yüzdesi
}

export interface GradingResult {
  question_no: number
  student_answer: string
  ai_score: number
  max_score: number
  confidence: number
  confidence_band: 'high' | 'mid' | 'low'
  review_required: boolean
  matched_alternatives: string[]
  rubric_scores: { criterion: string; awarded: number; max: number }[]
}

// ── Answer Key CRUD ───────────────────────────────────────────

/**
 * Sınav için cevap anahtarı yükle/oluştur.
 * Phase 3: Cloud Brain API üzerinden DB'ye yazar.
 */
export async function createAnswerKey(
  examId: string,
  version: number,
  entries: Omit<AnswerKeyEntry, 'id' | 'exam_id' | 'template_version' | 'created_at'>[],
): Promise<AnswerKeyEntry[]> {
  // Phase 3: POST /api/exam/{examId}/answer-key
  const now = new Date().toISOString()
  return entries.map((e, i) => ({
    id: `ak_${examId}_${i}`,
    exam_id: examId,
    template_version: version,
    question_no: e.question_no,
    max_score: e.max_score,
    correct_answer: e.correct_answer,
    alternatives: e.alternatives,
    rubric_json: e.rubric_json,
    partial_credit_rules: e.partial_credit_rules,
    created_at: now,
  }))
}

/**
 * Cevap anahtarını getir. Template version'a göre filtreler.
 * ADR-015 ile entegre — her şablon versiyonunun kendi anahtarı.
 */
export async function getAnswerKey(
  examId: string,
  version: number = 1,
): Promise<AnswerKeyEntry[]> {
  // Phase 3: GET /api/exam/{examId}/answer-key?version={version}
  return []
}

/**
 * Alternatif doğru cevapları eşleştir.
 * "4" = "dört" = "IV" = "four" — hepsi doğru kabul edilir.
 */
export function matchAlternative(
  studentAnswer: string,
  correctAnswer: string,
  alternatives: string[] = [],
): { matched: boolean; matchedValue: string } {
  const normalized = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, ' ')

  const targets = [correctAnswer, ...alternatives].map(normalized)
  const answer = normalized(studentAnswer)

  for (const target of targets) {
    if (answer === target) return { matched: true, matchedValue: target }
  }

  return { matched: false, matchedValue: '' }
}

/**
 * Rubrik bazlı kısmi puan hesapla (açık uçlu sorular).
 * Phase 3: AI/LLM rubrik kriterlerini değerlendirir.
 */
export function scoreWithRubric(
  rubric: RubricEntry[],
  satisfiedCriteria: string[],  // AI tarafından karşılandığı tespit edilenler
): { total: number; details: { criterion: string; awarded: number; max: number }[] } {
  let total = 0
  const details = rubric.map(r => {
    const satisfied = satisfiedCriteria.includes(r.criterion)
    const awarded = satisfied ? r.points : 0
    total += awarded
    return { criterion: r.criterion, awarded, max: r.points }
  })
  return { total, details }
}

// ── Güven Eşiği (Kural 12) ────────────────────────────────────

const DEFAULT_THRESHOLDS = {
  high: 0.85,   // >= 0.85 → otomatik kabul
  mid: 0.70,    // 0.70-0.85 → gözden geçir işareti
  // < 0.70 → TeacherReviewStarted ZORUNLU
}

export function assessConfidence(confidence: number): {
  band: 'high' | 'mid' | 'low'
  review_required: boolean
} {
  if (confidence >= DEFAULT_THRESHOLDS.high) {
    return { band: 'high', review_required: false }
  }
  if (confidence >= DEFAULT_THRESHOLDS.mid) {
    return { band: 'mid', review_required: false }
  }
  return { band: 'low', review_required: true }
}

/**
 * Öğrenci yanıtını cevap anahtarına göre puanla.
 * Phase 3: Gerçek AI grading bu fonksiyonun üzerine kurulur.
 */
export function gradeWithAnswerKey(
  studentAnswer: string,
  keyEntry: AnswerKeyEntry,
  aiScore: number,
  aiConfidence: number,
): GradingResult {
  const altMatch = matchAlternative(
    studentAnswer,
    keyEntry.correct_answer || '',
    keyEntry.alternatives || [],
  )

  const { band, review_required } = assessConfidence(aiConfidence)

  const result: GradingResult = {
    question_no: keyEntry.question_no,
    student_answer: studentAnswer,
    ai_score: aiScore,
    max_score: keyEntry.max_score,
    confidence: aiConfidence,
    confidence_band: band,
    review_required,
    matched_alternatives: altMatch.matched ? [altMatch.matchedValue] : [],
    rubric_scores: [],
  }

  return result
}
