/**
 * @doa/sync-engine
 *
 * Çevrimdışı AI Kuyruğu + Senkronizasyon — ADR-013.
 *
 * Akış (Anayasa Madde 4 — önce cihaz, sonra AI):
 *  1. OCR HER ZAMAN yerelde çalışır (cihazda, internet gerektirmez).
 *  2. AI grading gerekiyorsa önce yerel çözüm denenir (decision-engine).
 *  3. Cihaz çözemez + internet yoksa → iş `pending_ai_jobs` kuyruğuna alınır.
 *  4. İnternet gelince kuyruk toplu (batch) Cloud Brain'e gönderilir.
 *  5. Sonuçlar event olarak geri yazılır; öğretmene bildirim.
 *
 * Kuyruk SQLCipher'da `pending_ai_jobs` tablosunda (Freeze: yeni tablo, mevcut bozulmaz).
 */

// ── Tipler ─────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'sending' | 'done' | 'failed'

export interface PendingAIJob {
  jobId: string
  examId: string
  questionNo: number
  /** Yerelde çıkarılmış OCR metni — AI'a gönderilecek girdi */
  ocrText: string
  /** answer-key-engine'den beklenen cevap (varsa) */
  expectedAnswer?: string
  status: JobStatus
  /** Kaç kez gönderme denendi */
  attempts: number
  createdAt: string
  lastError?: string
}

export interface SyncResult {
  sent: number
  succeeded: number
  failed: number
  remaining: number
}

/** Kuyruk kalıcılığı — storage-engine / SQLCipher köprüsü. */
export interface JobQueueStore {
  enqueue(job: PendingAIJob): Promise<void>
  listByStatus(status: JobStatus): Promise<PendingAIJob[]>
  update(jobId: string, patch: Partial<PendingAIJob>): Promise<void>
  count(status: JobStatus): Promise<number>
}

/** Cloud Brain köprüsü — gerçek /api/grading çağrısı. */
export interface CloudGrader {
  grade(input: { examId: string; questionNo: number; ocrText: string; expectedAnswer?: string }):
    Promise<{ score: number; feedback: string }>
}

/** Event yayını (event-bus köprüsü). */
export type EmitFn = (event: string, payload: Record<string, unknown>) => void

// ── Sabitler ───────────────────────────────────────────────────

const MAX_ATTEMPTS = 5
/** Tek sync turunda gönderilecek azami iş (Cloud Brain'i boğmamak için). */
const BATCH_SIZE = 25

// ── Yardımcılar ────────────────────────────────────────────────

function newJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Sync Engine ────────────────────────────────────────────────

export class SyncEngine {
  constructor(
    private queue: JobQueueStore,
    private cloud: CloudGrader,
    private emit: EmitFn = () => {},
  ) {}

  /**
   * Cihazın çözemediği AI işini kuyruğa al (çevrimdışı durumda).
   * OCR zaten yapılmış; sadece anlamsal puanlama beklemede.
   */
  async enqueue(input: {
    examId: string
    questionNo: number
    ocrText: string
    expectedAnswer?: string
  }): Promise<PendingAIJob> {
    const job: PendingAIJob = {
      jobId: newJobId(),
      examId: input.examId,
      questionNo: input.questionNo,
      ocrText: input.ocrText,
      expectedAnswer: input.expectedAnswer,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    }
    await this.queue.enqueue(job)
    this.emit('AIJobQueued', { jobId: job.jobId, examId: job.examId, questionNo: job.questionNo })
    return job
  }

  /** Bekleyen iş sayısı — UI'da "N iş kuyrukta" bildirimi için. */
  async pendingCount(): Promise<number> {
    return this.queue.count('pending')
  }

  /**
   * Senkronizasyon turu. İnternet geldiğinde çağrılır.
   * Bekleyen işleri batch halinde Cloud Brain'e gönderir, sonuçları event'ler.
   */
  async sync(isOnline: boolean): Promise<SyncResult> {
    if (!isOnline) {
      const remaining = await this.queue.count('pending')
      return { sent: 0, succeeded: 0, failed: 0, remaining }
    }

    const pending = await this.queue.listByStatus('pending')
    const batch = pending.slice(0, BATCH_SIZE)
    let succeeded = 0
    let failed = 0

    for (const job of batch) {
      await this.queue.update(job.jobId, { status: 'sending', attempts: job.attempts + 1 })
      try {
        const result = await this.cloud.grade({
          examId: job.examId,
          questionNo: job.questionNo,
          ocrText: job.ocrText,
          expectedAnswer: job.expectedAnswer,
        })
        await this.queue.update(job.jobId, { status: 'done' })
        this.emit('AIJobCompleted', {
          jobId: job.jobId,
          examId: job.examId,
          questionNo: job.questionNo,
          score: result.score,
          feedback: result.feedback,
        })
        succeeded++
      } catch (err) {
        const attempts = job.attempts + 1
        const dead = attempts >= MAX_ATTEMPTS
        await this.queue.update(job.jobId, {
          status: dead ? 'failed' : 'pending',
          lastError: (err as Error).message,
        })
        if (dead) {
          this.emit('AIJobFailed', { jobId: job.jobId, error: (err as Error).message })
        }
        failed++
      }
    }

    const remaining = await this.queue.count('pending')
    return { sent: batch.length, succeeded, failed, remaining }
  }
}
