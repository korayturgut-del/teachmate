/**
 * DÖA Pipeline Köprüsü — "Önce Cihaz, Sonra AI" (Anayasa Madde 4)
 *
 * Her pipeline aşaması için:
 *   1. Tauri ortamındaysak → yerel Rust komutunu `invoke` ile çağır (CİHAZDA).
 *   2. Tarayıcı/dev ortamındaysak → Cloud Brain `/api/pipeline/...` fallback.
 *
 * Bu sayede OCR ve hafif işler buluta yük bindirmeden cihazda çözülür;
 * yalnızca cihazın çözemediği zor vakalar buluta gider.
 */

export type PipelineStage =
  | 'sayfa_ayirma'
  | 'ogrenci_bilgi'
  | 'ders_tespit'
  | 'ocr'
  | 'anlam_analizi'
  | 'surec_puanlama'

export interface StageResult {
  stage: PipelineStage
  ok: boolean
  source: 'device' | 'cloud'
  data?: any
  error?: string
}

/** Tauri ortamında mıyız? (window.__TAURI_INTERNALS__ veya __TAURI__ varsa) */
export function isTauri(): boolean {
  return typeof window !== 'undefined' &&
    (('__TAURI_INTERNALS__' in window) || ('__TAURI__' in window))
}

/** Tauri komut adı eşlemesi — her aşamanın yerel karşılığı. */
const TAURI_COMMANDS: Partial<Record<PipelineStage, string>> = {
  sayfa_ayirma: 'split_pages',
  ogrenci_bilgi: 'extract_student_info',
  ders_tespit: 'detect_subject',
  ocr: 'run_local_ocr',
}

/**
 * Tek bir aşamayı çalıştır. Önce cihaz (Tauri invoke), olmazsa bulut (fetch).
 */
export async function runStage(
  stage: PipelineStage,
  payload: Record<string, unknown> = {}
): Promise<StageResult> {
  // 1) ÖNCE CİHAZ — Tauri invoke (Anayasa Madde 4)
  if (isTauri()) {
    const cmd = TAURI_COMMANDS[stage]
    if (cmd) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const data = await invoke(cmd, payload)
        return { stage, ok: true, source: 'device', data }
      } catch (err) {
        // Cihazda çözülemedi → buluta düş (graceful degradation)
        // eslint-disable-next-line no-console
        console.warn(`[pipeline] ${stage} cihazda başarısız, buluta düşülüyor:`, err)
      }
    }
  }

  // 2) SONRA BULUT — Cloud Brain fallback
  try {
    const res = await fetch(`/api/pipeline/${stage}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { stage, ok: false, source: 'cloud', error: `API ${res.status}` }
    }
    const data = await res.json()
    return { stage, ok: true, source: 'cloud', data }
  } catch (err) {
    return { stage, ok: false, source: 'cloud', error: (err as Error).message }
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH v1.8 — UÇTAN UCA GRADING (Cevap Anahtarı → Rubrik → AI)
// ═══════════════════════════════════════════════════════════════

export interface QuestionInput {
  question_no: number
  question_text?: string
  student_answer?: string
  max_score?: number
  question_type?: 'open' | 'closed'
  correct_answer?: string | null
  alternatives?: string[] | null
  rubric?: Array<{ criterion: string; keyword: string; points: number }> | null
}

export interface GradedQuestion {
  question_no: number
  ai_score: number
  max_score: number
  explanation: string
  confidence: number
  confidence_band: 'high' | 'mid' | 'low'
  review_required: boolean
  route: string
  source: 'answer_key' | 'rubric' | 'ai_heuristic'
}

export interface FullRunResult {
  exam_id: string
  questions: GradedQuestion[]
  total_score: number
  total_max: number
  needs_review_count: number
}

/**
 * Uçtan uca değerlendirme: tüm soruları cevap anahtarı → rubrik → AI
 * zincirinden geçirir. Sonuç dijital masada gösterilir.
 */
export async function gradeFullExam(req: {
  exam_id: string
  subject?: string
  is_online?: boolean
  ocr_confidence?: number
  questions: QuestionInput[]
}): Promise<FullRunResult> {
  const res = await fetch('/api/pipeline/run-full', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_online: navigator.onLine,
      ocr_confidence: 0.9,
      ...req,
    }),
  })
  if (!res.ok) throw new Error(`Grading API ${res.status}`)
  return res.json()
}

// ═══════════════════════════════════════════════════════════════
// PATCH v1.9 — GERÇEK SORU VERİSİ (OCR → Segmentasyon)
// ═══════════════════════════════════════════════════════════════

export interface SegmentedRegion {
  question_no: number
  text: string
  confidence: number
  line_count: number
  bbox?: number[] | null
  max_score?: number | null
}

export interface SegmentResult {
  regions: SegmentedRegion[]
  method: 'template' | 'auto'
  total_confidence: number
}

/**
 * Sayfayı gerçek soru bölgelerine ayır (OCR → segmentasyon).
 * Tauri ortamında ileride yerel Rust segment komutuna düşebilir; şimdilik bulut.
 */
export async function segmentPage(input: {
  image_base64?: string | null
  template_questions?: Array<{ question_no: number; bbox: number[]; max_score: number }> | null
}): Promise<SegmentResult> {
  const res = await fetch('/api/pipeline/segment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Segment API ${res.status}`)
  return res.json()
}

/**
 * Segment bölgelerini run-full için soru-cevap çiftlerine dönüştür.
 * Her bölgenin metni öğrenci yanıtı olur; cevap anahtarı/rubrik (varsa) eklenir.
 */
export function regionsToQuestions(
  regions: SegmentedRegion[],
  answerKey?: Record<number, { correct_answer?: string; alternatives?: string[]; rubric?: any[]; max_score?: number }>,
): QuestionInput[] {
  return regions.map((r) => {
    const key = answerKey?.[r.question_no]
    return {
      question_no: r.question_no,
      question_text: `Soru ${r.question_no}`,
      student_answer: r.text,                    // GERÇEK OCR metni
      max_score: key?.max_score ?? r.max_score ?? 10,
      question_type: key?.correct_answer ? 'closed' : 'open',
      correct_answer: key?.correct_answer ?? null,
      alternatives: key?.alternatives ?? null,
      rubric: key?.rubric ?? null,
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// PATCH v1.16 — ARŞİVDEN ÇIKAR + TEKRAR DÜZENLE (Adım 2)
// ═══════════════════════════════════════════════════════════════

export interface DeskSnapshot {
  version: number
  examId: string
  pageImageUrl?: string
  overlays: any[]
  annotations: any[]
  pressureStrokes?: any[]
  totalScore: number
  maxTotal: number
  savedAt: string
}

/** Masa durumunu arşive kaydet (puanlar + notlar + kalem darbeleri). */
export async function saveDeskSnapshot(examId: string, snapshot: DeskSnapshot): Promise<boolean> {
  const res = await fetch(`/api/archive/snapshot/${encodeURIComponent(examId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot }),
  })
  return res.ok
}

/** Arşivden masa durumunu geri getir (tekrar düzenleme için). */
export async function loadDeskSnapshot(examId: string): Promise<DeskSnapshot | null> {
  const res = await fetch(`/api/archive/snapshot/${encodeURIComponent(examId)}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.snapshot ?? null
}
