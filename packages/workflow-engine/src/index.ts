/**
 * @doa/workflow-engine
 *
 * Sınav Yaşam Döngüsü — State Machine.
 *
 * EVENT_CATALOG'daki event akışını TypeScript'te modeller ve DOĞRULAR.
 * Amaç: geçersiz sıra (örn. OCR'dan önce puanlama, eşleşmeden önce OCR) gibi
 * mantık hatalarını ÇALIŞMA ZAMANINDA yakalamak.
 *
 * İki ana akış (event-bus/workflow.py ile aynı domain):
 *  - Masaüstü ADF: ExamCreated → QRCodeGenerated → TemplatePrinted →
 *    ScanSessionStarted → PageScanned → StudentMatched → OCRCompleted →
 *    AIGradingStarted → AIGradingCompleted → TeacherReviewStarted → GradeOverridden
 *  - Mobil tek kağıt: MobileCaptureStarted → QuickOCRCompleted → TeacherReviewStarted
 */

// ── Tipler ─────────────────────────────────────────────────────

export type WorkflowEvent =
  | 'ExamCreated'
  | 'TemplateVersionCreated'
  | 'QRCodeGenerated'
  | 'TemplatePrinted'
  | 'ScanSessionStarted'
  | 'PageScanned'
  | 'StudentMatched'
  | 'StudentMatchRejected'
  | 'OCRCompleted'
  | 'AIGradingStarted'
  | 'AIGradingQueued'
  | 'AIGradingCompleted'
  | 'TeacherReviewStarted'
  | 'GradeOverridden'
  | 'ReportGenerated'
  // Mobil
  | 'MobileCaptureStarted'
  | 'QuickOCRCompleted'

export type WorkflowPhase =
  | 'draft'          // sınav oluşturuldu, henüz basılmadı
  | 'printed'        // QR + şablon basıldı
  | 'scanning'       // tarama oturumu açık
  | 'recognized'     // OCR bitti
  | 'grading'        // AI puanlıyor / kuyrukta
  | 'review'         // öğretmen masada
  | 'completed'      // rapor üretildi

export interface TransitionResult {
  ok: boolean
  from: WorkflowPhase
  to: WorkflowPhase
  event: WorkflowEvent
  /** Reddedildiyse insan-okunur gerekçe (audit) */
  reason?: string
}

// ── Geçiş Tablosu ──────────────────────────────────────────────
// Her faz, hangi event'lerle hangi faza geçebileceğini tanımlar.

const TRANSITIONS: Record<WorkflowPhase, Partial<Record<WorkflowEvent, WorkflowPhase>>> = {
  draft: {
    TemplateVersionCreated: 'draft',
    QRCodeGenerated: 'draft',
    TemplatePrinted: 'printed',
    // Mobil tek kağıt akışı taslaktan doğrudan tanımaya geçebilir
    MobileCaptureStarted: 'scanning',
  },
  printed: {
    ScanSessionStarted: 'scanning',
    MobileCaptureStarted: 'scanning',
  },
  scanning: {
    PageScanned: 'scanning',
    StudentMatched: 'scanning',
    StudentMatchRejected: 'scanning', // audit; oturum devam eder
    OCRCompleted: 'recognized',
    QuickOCRCompleted: 'recognized',
  },
  recognized: {
    AIGradingStarted: 'grading',
    AIGradingQueued: 'grading',     // çevrimdışı kuyruk (ADR-013)
    TeacherReviewStarted: 'review', // AI atlanıp doğrudan inceleme
  },
  grading: {
    AIGradingCompleted: 'review',
    AIGradingQueued: 'grading',
    TeacherReviewStarted: 'review',
  },
  review: {
    GradeOverridden: 'review',      // birden çok düzeltme olabilir
    TeacherReviewStarted: 'review',
    ReportGenerated: 'completed',
  },
  completed: {
    // Terminal — yeniden inceleme için sadece review'a dönülebilir
    TeacherReviewStarted: 'review',
  },
}

// ── Workflow Engine ────────────────────────────────────────────

export class WorkflowEngine {
  private _phase: WorkflowPhase
  private _history: WorkflowEvent[] = []

  constructor(initial: WorkflowPhase = 'draft') {
    this._phase = initial
  }

  get phase(): WorkflowPhase {
    return this._phase
  }

  get history(): readonly WorkflowEvent[] {
    return this._history
  }

  /** Bu event şu anki fazda geçerli mi? (uygulamadan) */
  canApply(event: WorkflowEvent): boolean {
    return TRANSITIONS[this._phase][event] !== undefined
  }

  /**
   * Event uygula. Geçersizse faz değişmez, ok:false döner (mantık hatası yakalanır).
   */
  apply(event: WorkflowEvent): TransitionResult {
    const from = this._phase
    const to = TRANSITIONS[from][event]
    if (to === undefined) {
      return {
        ok: false,
        from,
        to: from,
        event,
        reason: `Geçersiz geçiş: '${from}' fazında '${event}' beklenmiyor.`,
      }
    }
    this._phase = to
    this._history.push(event)
    return { ok: true, from, to, event }
  }

  /** Bir event dizisini sırayla uygula; ilk geçersizde durur. */
  applySequence(events: WorkflowEvent[]): TransitionResult[] {
    const results: TransitionResult[] = []
    for (const e of events) {
      const r = this.apply(e)
      results.push(r)
      if (!r.ok) break
    }
    return results
  }

  /** Sınav tamamlandı mı? */
  get isCompleted(): boolean {
    return this._phase === 'completed'
  }
}
