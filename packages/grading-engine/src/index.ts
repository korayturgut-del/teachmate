/**
 * @doa/grading-engine
 *
 * AI Puanlama Geçiş Katmanı — Mock AI ↔ DeepSeek ↔ Gemini.
 * Phase 3: Gerçek AI grading + confidence threshold (Kural 12).
 *
 * Bu paket, hangi AI provider'ın kullanılacağını soyutlar.
 * UI ve workflow bileşenleri bu paketi kullanır, provider detayını bilmez.
 */

import type { AnswerKeyEntry, GradingResult } from '@doa/answer-key-engine'
import { decide, trackDecision, type DecisionContext, type QuestionType } from '@doa/decision-engine'

// ── Tipler ─────────────────────────────────────────────────────

export type AIProvider = 'mock' | 'deepseek' | 'gemini' | 'auto'
export type DecisionRoute = 'local_resolve' | 'cloud_escalate' | 'offline_queue'

export interface GradingRequest {
  question: string
  answer: string
  maxScore: number
  subject?: string
  rubric?: Record<string, unknown>
  answerKey?: AnswerKeyEntry
  questionNo?: number
  examId?: string
  studentId?: string
  /** Decision Engine için */
  ocrConfidence?: number
  questionType?: 'closed' | 'open'
  teacherId?: string
  isOnline?: boolean
}

export interface GradingResponse {
  score: number
  maxScore: number
  explanation: string
  confidence: number
  confidenceBand: 'high' | 'mid' | 'low'
  reviewRequired: boolean
  provider: AIProvider
  fallbackUsed: boolean
  fallbackReason?: string
  /** ADR-018: Decision Engine rotası */
  decisionRoute?: DecisionRoute
}

export interface BatchGradingResult {
  results: GradingResponse[]
  totalScore: number
  totalMaxScore: number
  provider: AIProvider
}

// ── Confidence Threshold (Kural 12) ──────────────────────────

const DEFAULT_THRESHOLDS = {
  /** ≥ 0.85 → otomatik kabul */
  HIGH: 0.85,
  /** 0.70 - 0.85 → "gözden geçir" işareti */
  MID: 0.70,
  /** < 0.70 → TeacherReviewStarted ZORUNLU */
}

/**
 * AI güven skorunu değerlendir.
 * Kural 12: Düşük güvenli puanlar öğretmene zorla gösterilir.
 */
export function assessConfidence(confidence: number): {
  band: 'high' | 'mid' | 'low'
  reviewRequired: boolean
} {
  if (confidence >= DEFAULT_THRESHOLDS.HIGH) {
    return { band: 'high', reviewRequired: false }
  }
  if (confidence >= DEFAULT_THRESHOLDS.MID) {
    return { band: 'mid', reviewRequired: false }
  }
  return { band: 'low', reviewRequired: true }
}

// ── Grading Queue ─────────────────────────────────────────────

interface QueueItem extends GradingRequest {
  id: string
  queuedAt: number
  retries: number
}

class GradingQueue {
  private queue: QueueItem[] = []
  private processing = false
  private concurrency = 3
  private maxRetries = 2

  constructor(
    private onGrade: (req: GradingRequest) => Promise<GradingResponse>,
  ) {}

  /** İş kuyruğa ekle */
  enqueue(request: GradingRequest): string {
    const id = `gq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    this.queue.push({ ...request, id, queuedAt: Date.now(), retries: 0 })
    this.processQueue()
    return id
  }

  /** Toplu ekle */
  enqueueBatch(requests: GradingRequest[]): string[] {
    return requests.map(r => this.enqueue(r))
  }

  /** Kuyruğu işle */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return
    this.processing = true

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency)
      const results = await Promise.allSettled(
        batch.map(item => this.processItem(item))
      )

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === 'rejected' && batch[i].retries < this.maxRetries) {
          batch[i].retries++
          this.queue.push(batch[i])
        }
      }
    }

    this.processing = false
  }

  private async processItem(item: QueueItem): Promise<void> {
    try {
      await this.onGrade(item)
    } catch {
      if (item.retries >= this.maxRetries) {
        console.error(`[GradingQueue] Max retries exceeded for ${item.id}`)
      }
    }
  }

  get size(): number { return this.queue.length }
}

// ── Grading Engine ────────────────────────────────────────────

export class GradingEngine {
  private provider: AIProvider = 'auto'
  private cloudBrainUrl: string

  constructor(cloudBrainUrl = 'http://localhost:8000') {
    this.cloudBrainUrl = cloudBrainUrl
  }

  /** Tek soru puanla — ADR-018: önce Decision Engine, sonra AI. */
  async grade(request: GradingRequest): Promise<GradingResponse> {
    // ═══ ADR-018: DECISION ENGINE — sistemin beyni ═══
    if (request.ocrConfidence !== undefined && request.questionType) {
      const ctx: DecisionContext = {
        ocrConfidence: request.ocrConfidence,
        questionType: request.questionType,
        teacherId: request.teacherId || 'default',
        isOnline: request.isOnline ?? true,
        examId: request.examId || 'unknown',
        questionNo: request.questionNo || 0,
      }

      const decision = decide(ctx)
      trackDecision(decision)

      // ── YEREL ÇÖZÜM ──
      if (decision.route === 'local_resolve') {
        return this.resolveLocal(request, decision)
      }

      // ── OFFLINE KUYRUK ──
      if (decision.route === 'offline_queue') {
        return this.queueForLater(request, decision)
      }

      // ── BULUT YÜKSELTME ──
      // continue to Cloud Brain below, but attach decision metadata
    }
    // ════════════════════════════════════════════════════════

    try {
      // Gerçek API'ye istek
      const res = await fetch(`${this.cloudBrainUrl}/api/grading/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: request.question,
          answer: request.answer,
          max_score: request.maxScore,
          subject: request.subject || '',
          rubric: request.rubric,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      return {
        score: data.score,
        maxScore: data.max_score,
        explanation: data.explanation,
        confidence: data.confidence,
        confidenceBand: data.confidence_band as 'high' | 'mid' | 'low',
        reviewRequired: data.review_required,
        provider: data.provider || 'deepseek',
        fallbackUsed: data.provider === 'mock',
      }
    } catch {
      // Fallback: Mock AI (istemci tarafı)
      return this.mockGrade(request)
    }
  }

  /** Toplu puanla */
  async gradeBatch(
    requests: GradingRequest[],
  ): Promise<BatchGradingResult> {
    const results = await Promise.all(requests.map(r => this.grade(r)))
    return {
      results,
      totalScore: results.reduce((s, r) => s + r.score, 0),
      totalMaxScore: results.reduce((s, r) => s + r.maxScore, 0),
      provider: results[0]?.provider || 'mock',
    }
  }

  /** Mock yedek puanlama (çevrimdışı) */
  private mockGrade(request: GradingRequest): GradingResponse {
    const answerLen = request.answer?.length || 0
    let ratio = 0.5
    if (answerLen < 5) ratio = 0.1
    else if (answerLen < 20) ratio = 0.35
    else if (answerLen < 100) ratio = 0.6
    else ratio = 0.75

    const score = Math.min(
      Math.round(request.maxScore * (ratio + Math.random() * 0.25)),
      request.maxScore
    )
    const confidence = 0.5 + Math.random() * 0.3

    return {
      score, maxScore: request.maxScore,
      explanation: '[OFFLINE] Cloud Brain erişilemedi — yerel mock puanlama.',
      confidence,
      confidenceBand: confidence >= 0.7 ? 'mid' : 'low',
      reviewRequired: confidence < 0.7,
      provider: 'mock',
      fallbackUsed: true,
      fallbackReason: 'offline',
    }
  }

  /** Sağlık kontrolü */
  async health(): Promise<{ provider: string; available: boolean }> {
    try {
      const res = await fetch(
        `${this.cloudBrainUrl}/api/grading/health`
      )
      return await res.json()
    } catch {
      return { provider: 'mock', available: false }
    }
  }

  // ── ADR-018: Yerel Çözüm ────────────────────────────────
  private resolveLocal(
    request: GradingRequest,
    decision: { reason: string; requiresTeacherReview: boolean },
  ): GradingResponse {
    const keyEntry = request.answerKey
    let score = 0
    let explanation = decision.reason

    if (keyEntry && request.answer) {
      const { matchAlternative } = require('@doa/answer-key-engine')
      const match = matchAlternative(
        request.answer,
        keyEntry.correct_answer || '',
        keyEntry.alternatives || [],
      )
      if (match.matched) {
        score = keyEntry.max_score
        explanation = `Yerel eşleşme: "${match.matchedValue}" = doğru. ${decision.reason}`
      }
    }

    return {
      score, maxScore: request.maxScore, explanation,
      confidence: request.ocrConfidence || 0.95,
      confidenceBand: (request.ocrConfidence || 0.95) >= 0.85 ? 'high' : 'mid',
      reviewRequired: decision.requiresTeacherReview,
      provider: 'mock', fallbackUsed: false,
      decisionRoute: 'local_resolve',
    }
  }

  // ── ADR-018: Offline Kuyruk ──────────────────────────────
  private queueForLater(
    request: GradingRequest,
    decision: { reason: string; requiresTeacherReview: boolean },
  ): GradingResponse {
    console.log('[OfflineQueue]', request.examId, request.questionNo)
    return {
      score: 0, maxScore: request.maxScore,
      explanation: `[KUYRUKTA] ${decision.reason}`,
      confidence: request.ocrConfidence || 0.5,
      confidenceBand: 'low', reviewRequired: true,
      provider: 'mock', fallbackUsed: true,
      fallbackReason: 'offline_queued',
      decisionRoute: 'offline_queue',
    }
  }
}
