/**
 * @doa/digital-desk
 *
 * Dijital Masa — State & İş Mantığı (UI'dan ayrık, test edilebilir çekirdek).
 *
 * Konva tabanlı `digital-desk.tsx` bileşeni bu çekirdeği kullanır.
 * Buradaki en kritik iş: öğretmen AI puanını değiştirdiğinde `GradeOverridden`
 * event'i üretmek. Bu event ADR-016 öğretmen karar profilinin VERİ KAYNAĞIDIR.
 * "AI 7 verdi, öğretmen 8 yaptı" → bu delta profile beslenir.
 */

// ── Tipler ─────────────────────────────────────────────────────

export type ScoreStatus = 'correct' | 'partial' | 'wrong'

export interface ScoreOverlay {
  questionNo: number
  /** AI'ın verdiği ham puan */
  aiScore: number
  /** Öğretmenin (varsa) düzelttiği puan */
  teacherScore?: number
  maxScore: number
  status: ScoreStatus
  /** Sayfadaki konum [ymin,xmin,ymax,xmax] / 1000 */
  bbox: [number, number, number, number]
}

export type AnnotationKind = 'pen' | 'highlight' | 'text'

export interface Annotation {
  id: string
  kind: AnnotationKind
  /** Serbest çizim için nokta dizisi; metin için tek nokta */
  points: number[]
  text?: string
  color: string
  createdBy: string
  createdAt: string
}

export interface DeskState {
  examId: string
  pageImageUrl?: string
  overlays: ScoreOverlay[]
  annotations: Annotation[]
  /** Toplam: öğretmen düzeltmesi varsa o, yoksa AI puanı */
  totalScore: number
  maxTotal: number
}

export type EmitFn = (event: string, payload: Record<string, unknown>) => void

// ── Yardımcılar ────────────────────────────────────────────────

function annId(): string {
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Bir overlay'in etkin puanı: öğretmen düzeltmesi öncelikli. */
export function effectiveScore(o: ScoreOverlay): number {
  return o.teacherScore ?? o.aiScore
}

function statusFor(score: number, max: number): ScoreStatus {
  if (max <= 0) return 'wrong'
  const ratio = score / max
  if (ratio >= 0.99) return 'correct'
  if (ratio <= 0.01) return 'wrong'
  return 'partial'
}

function recomputeTotals(state: DeskState): void {
  state.totalScore = state.overlays.reduce((sum, o) => sum + effectiveScore(o), 0)
  state.maxTotal = state.overlays.reduce((sum, o) => sum + o.maxScore, 0)
}

// ── Digital Desk (state controller) ────────────────────────────

export class DigitalDeskController {
  state: DeskState

  constructor(
    examId: string,
    overlays: ScoreOverlay[] = [],
    private teacherId: string = 'unknown',
    private emit: EmitFn = () => {},
    pageImageUrl?: string,
  ) {
    this.state = {
      examId,
      pageImageUrl,
      overlays: overlays.map((o) => ({ ...o })),
      annotations: [],
      totalScore: 0,
      maxTotal: 0,
    }
    recomputeTotals(this.state)
  }

  /**
   * Öğretmen bir sorunun puanını değiştirir.
   * GradeOverridden event'i üretilir (ADR-016 profil verisi).
   */
  overrideScore(questionNo: number, newScore: number): void {
    const o = this.state.overlays.find((x) => x.questionNo === questionNo)
    if (!o) return

    const clamped = Math.max(0, Math.min(newScore, o.maxScore))
    const delta = clamped - o.aiScore
    o.teacherScore = clamped
    o.status = statusFor(clamped, o.maxScore)
    recomputeTotals(this.state)

    // ADR-016: bu event öğretmen profilinin ham verisidir.
    this.emit('GradeOverridden', {
      examId: this.state.examId,
      questionNo,
      teacherId: this.teacherId,
      aiScore: o.aiScore,
      teacherScore: clamped,
      delta,
    })
  }

  /** Annotation ekle (kalem/işaretleme/metin). */
  addAnnotation(kind: AnnotationKind, points: number[], opts: { text?: string; color?: string } = {}): Annotation {
    const ann: Annotation = {
      id: annId(),
      kind,
      points,
      text: opts.text,
      color: opts.color ?? (kind === 'highlight' ? '#fde047' : '#ef4444'),
      createdBy: this.teacherId,
      createdAt: new Date().toISOString(),
    }
    this.state.annotations.push(ann)
    this.emit('AnnotationAdded', { examId: this.state.examId, annotationId: ann.id, kind })
    return ann
  }

  removeAnnotation(id: string): void {
    this.state.annotations = this.state.annotations.filter((a) => a.id !== id)
  }

  /** Yüzde olarak toplam başarı. */
  get percentage(): number {
    if (this.state.maxTotal <= 0) return 0
    return Math.round((this.state.totalScore / this.state.maxTotal) * 100)
  }

  // ── v1.10: Basınca Duyarlı Çizim ─────────────────────────────

  /** v1.10 basınçlı stroke deposu (perfect-freehand girdisi). */
  pressureStrokes: PressureStroke[] = []

  /**
   * Basınca duyarlı kalem darbesi ekler (Apple Pencil / stylus).
   * Palm rejection: stylus olmayan girdi (avuç teması) reddedilir.
   */
  addPressureStroke(
    inputPoints: StrokePoint[],
    opts: { color?: string; options?: FreehandOptions } = {},
  ): PressureStroke | null {
    // Palm rejection — geçerli kalem hareketi değilse yok say
    if (!isLikelyStylus(inputPoints)) {
      this.emit('StrokeRejected', {
        examId: this.state.examId,
        reason: 'palm_rejection',
        pointCount: inputPoints.length,
      })
      return null
    }

    const stroke: PressureStroke = {
      id: annId(),
      inputPoints,
      color: opts.color ?? '#ef4444',
      options: opts.options ?? DEFAULT_FREEHAND,
      createdBy: this.teacherId,
      createdAt: new Date().toISOString(),
    }
    this.pressureStrokes.push(stroke)
    this.emit('AnnotationAdded', {
      examId: this.state.examId,
      annotationId: stroke.id,
      kind: 'pressure_stroke',
    })
    return stroke
  }

  removePressureStroke(id: string): void {
    this.pressureStrokes = this.pressureStrokes.filter((s) => s.id !== id)
  }

  // ── v1.10: Toplu Onay (bulk-approve) ─────────────────────────

  /**
   * Yüksek güvenli soruları toplu onaylar. Düşük güvenli olanlar
   * öğretmen incelemesine kalır. AI puanları olduğu gibi kabul edilir
   * (teacherScore = aiScore), GradeOverridden ÜRETİLMEZ — çünkü
   * öğretmen değiştirmedi, sadece onayladı.
   *
   * @param confidences Soru no → OCR/AI güven skoru haritası
   * @param threshold  Bu eşiğin üstü otomatik onaylanır (varsayılan 0.85)
   */
  bulkApprove(
    confidences: Record<number, number>,
    threshold = 0.85,
  ): BulkApproveResult {
    const approved: number[] = []
    const needsReview: number[] = []

    for (const o of this.state.overlays) {
      const conf = confidences[o.questionNo] ?? 0
      if (conf >= threshold) {
        // Onayla: AI puanı kabul edildi (override değil, onay)
        if (o.teacherScore === undefined) {
          o.teacherScore = o.aiScore
        }
        approved.push(o.questionNo)
      } else {
        needsReview.push(o.questionNo)
      }
    }
    recomputeTotals(this.state)

    this.emit('BulkApproved', {
      examId: this.state.examId,
      teacherId: this.teacherId,
      approvedCount: approved.length,
      reviewCount: needsReview.length,
      threshold,
    })
    return { approved, needsReview }
  }

  // ── v1.16: Arşivleme & Geri Yükleme (serialize / restore) ─────
  // Master prompt: öğretmen arşivden çıkarıp masada tekrar düzenleyebilmeli.

  /**
   * Masa durumunu tam serialize eder (görüntü hariç — o ayrı arşivlenir).
   * Sonuç JSON olarak SQLCipher arşivine yazılır.
   */
  serialize(): DeskSnapshot {
    return {
      version: 1,
      examId: this.state.examId,
      pageImageUrl: this.state.pageImageUrl,
      overlays: this.state.overlays.map((o) => ({ ...o })),
      annotations: this.state.annotations.map((a) => ({ ...a })),
      pressureStrokes: this.pressureStrokes.map((s) => ({ ...s })),
      totalScore: this.state.totalScore,
      maxTotal: this.state.maxTotal,
      savedAt: new Date().toISOString(),
    }
  }

  /**
   * Arşivlenmiş bir masa durumunu geri yükler — öğretmen tekrar düzenleyebilir.
   * Tüm katmanlar (puanlar, notlar, kalem darbeleri) korunur.
   */
  static restore(
    snapshot: DeskSnapshot,
    teacherId = 'unknown',
    emit: EmitFn = () => {},
  ): DigitalDeskController {
    const ctrl = new DigitalDeskController(
      snapshot.examId,
      snapshot.overlays,
      teacherId,
      emit,
      snapshot.pageImageUrl,
    )
    ctrl.state.annotations = snapshot.annotations.map((a) => ({ ...a }))
    ctrl.pressureStrokes = (snapshot.pressureStrokes ?? []).map((s) => ({ ...s }))
    recomputeTotals(ctrl.state)
    emit('DeskRestoredFromArchive', {
      examId: snapshot.examId,
      annotationCount: ctrl.state.annotations.length,
      strokeCount: ctrl.pressureStrokes.length,
    })
    return ctrl
  }
}

/** Arşivlenebilir masa anlık görüntüsü (SQLCipher'a JSON olarak yazılır). */
export interface DeskSnapshot {
  version: number
  examId: string
  pageImageUrl?: string
  overlays: ScoreOverlay[]
  annotations: Annotation[]
  pressureStrokes?: PressureStroke[]
  totalScore: number
  maxTotal: number
  savedAt: string
}

// ════════════════════════════════════════════════════════════════
// v1.10 — KALEM BASINCI · GÜVEN ISI HARİTASI · TOPLU ONAY
// Master prompt: perfect-freehand + Pointer Events pressure +
//                confidence heat-map + bulk-approve.
// UI'dan ayrık, test edilebilir çekirdek. Konva bileşeni bunu kullanır.
// ════════════════════════════════════════════════════════════════

// ── Basınca Duyarlı Çizim (perfect-freehand girdi modeli) ──────

/**
 * Tek bir kalem girdisi noktası. Pointer Events'ten gelir:
 * `e.pressure` (0-1), Apple Pencil / stylus gerçek basınç verir,
 * parmak/fare sabit 0.5 döner.
 */
export interface StrokePoint {
  x: number
  y: number
  /** Pointer Events pressure: 0.0–1.0 */
  pressure: number
  /** Zaman damgası (ms) — hız bazlı incelme için */
  t: number
}

/**
 * perfect-freehand `getStroke()` seçenekleri.
 * Bu paket girdi modelini ve seçenekleri tanımlar; gerçek
 * `getStroke()` çağrısı UI tarafında perfect-freehand ile yapılır.
 */
export interface FreehandOptions {
  /** Temel çizgi kalınlığı (px) */
  size: number
  /** Basıncın kalınlığa etkisi: 0 = etkisiz, 1 = tam etki */
  thinning: number
  /** Yumuşatma (0–1) */
  smoothing: number
  /** Hız bazlı incelme akışkanlığı (0–1) */
  streamline: number
  /** true → gerçek basınç kullan; false → hız simülasyonu */
  simulatePressure: boolean
}

/** Apple Pencil / stylus için ayarlanmış varsayılan (master prompt). */
export const DEFAULT_FREEHAND: FreehandOptions = {
  size: 6,
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: false, // gerçek pressure verisi var
}

/** Basınçlı annotation — points yerine StrokePoint dizisi taşır. */
export interface PressureStroke {
  id: string
  inputPoints: StrokePoint[]
  color: string
  options: FreehandOptions
  createdBy: string
  createdAt: string
}

/**
 * Palm rejection: avuç teması büyük alanlı + düşük/değişken basınçlıdır.
 * Stylus girdisi tutarlı basınç + ince iz bırakır. Bu fonksiyon bir
 * girdi dizisinin geçerli kalem hareketi olup olmadığını söyler.
 */
export function isLikelyStylus(points: StrokePoint[]): boolean {
  if (points.length < 2) return false
  // Avuç teması: noktaların çoğu pressure≈0 veya pressure>0.95 (düz temas)
  const meaningful = points.filter((p) => p.pressure > 0.05 && p.pressure < 0.98)
  return meaningful.length >= points.length * 0.6
}

// ── Güven Isı Haritası ─────────────────────────────────────────

export type ConfidenceBand = 'high' | 'mid' | 'low'

export interface HeatCell {
  /** OCR'ın okuduğu kelime/bölge metni */
  text: string
  confidence: number
  band: ConfidenceBand
  /** Sayfadaki konum [ymin,xmin,ymax,xmax] / 1000 */
  bbox: [number, number, number, number]
  /** Isı haritası rengi (RGBA, düşük güven = kırmızı) */
  color: string
}

/** Güven değerini banda çevir (Kural 12 eşikleriyle hizalı). */
export function confidenceBand(c: number): ConfidenceBand {
  if (c >= 0.85) return 'high'
  if (c >= 0.70) return 'mid'
  return 'low'
}

/** Banda göre ısı haritası rengi — düşük güven dikkat çeker. */
function heatColor(band: ConfidenceBand): string {
  switch (band) {
    case 'high': return 'rgba(34,197,94,0.18)'   // yeşil, hafif
    case 'mid':  return 'rgba(250,204,21,0.30)'  // sarı
    case 'low':  return 'rgba(239,68,68,0.42)'   // kırmızı, belirgin
  }
}

/**
 * OCR kelime/bölge listesini ısı haritası hücrelerine çevirir.
 * Düşük güvenli kelimeler öğretmene görsel olarak işaretlenir —
 * "şuraya bak" sinyali. Master prompt v1.10 gereği.
 */
export function buildHeatMap(
  words: Array<{ text: string; confidence: number; bbox: [number, number, number, number] }>,
): HeatCell[] {
  return words.map((w) => {
    const band = confidenceBand(w.confidence)
    return {
      text: w.text,
      confidence: w.confidence,
      band,
      bbox: w.bbox,
      color: heatColor(band),
    }
  })
}

/** Isı haritası özeti — kaç kelime hangi banda düşüyor. */
export function heatMapSummary(cells: HeatCell[]): {
  total: number
  high: number
  mid: number
  low: number
  /** Düşük güvenli kelime oranı (0–1) — sayfanın "riskli"liği */
  riskRatio: number
} {
  const high = cells.filter((c) => c.band === 'high').length
  const mid = cells.filter((c) => c.band === 'mid').length
  const low = cells.filter((c) => c.band === 'low').length
  const total = cells.length
  return {
    total, high, mid, low,
    riskRatio: total > 0 ? low / total : 0,
  }
}

// ── Toplu Onay (bulk-approve) ──────────────────────────────────

export interface BulkApproveResult {
  /** Otomatik onaylanan soru numaraları */
  approved: number[]
  /** Öğretmen incelemesi gereken (düşük güven) soru numaraları */
  needsReview: number[]
}

