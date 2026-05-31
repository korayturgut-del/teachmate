import Konva from 'konva'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group, Line, Circle } from 'react-konva'
import { getStroke } from 'perfect-freehand'

// PATCH v1.16 (Adım 5): perfect-freehand outline'ı Konva flat-points'e çevir
function strokeToFlatPoints(input: number[][]): number[] {
  const outline = getStroke(input, {
    size: 8, thinning: 0.6, smoothing: 0.5, streamline: 0.5,
  })
  return outline.flat()
}

// ── Types ─────────────────────────────────────────
export interface Annotation {
  id: string
  type: 'highlight' | 'strike' | 'circle' | 'freehand' | 'text'
  points?: number[]
  text?: string
  color: string
  strokeWidth: number
}

export interface ScoreOverlay {
  questionNo: number
  score: number
  maxScore: number
  status: 'correct' | 'partial' | 'wrong'
  bbox: [number, number, number, number] // [ymin, xmin, ymax, xmax]
  explanation: string
  // v1.14 — Teacher Trust
  source?: 'answer_key' | 'rubric' | 'ai_heuristic'
  rubricScores?: Array<{ criterion: string; awarded: number; max: number }>
  confidence?: number
  reviewRequired?: boolean
}

export interface DigitalDeskProps {
  /** Exam page image URL (from R2 or local) */
  imageUrl?: string
  /** Natural dimensions of the original image */
  naturalWidth?: number
  naturalHeight?: number
  /** AI-scored overlays for each question */
  overlays?: ScoreOverlay[]
  /** Teacher's name (for annotation attribution) */
  teacherName?: string
  /** Called when teacher modifies a score */
  onScoreChange?: (questionNo: number, newScore: number) => void
  /** Called when teacher adds an annotation */
  onAnnotationAdd?: (annotation: Annotation) => void
}

// ── BBox → Pixel Converter ───────────────────────
function bboxToPixels(
  bbox: [number, number, number, number],
  containerWidth: number,
  containerHeight: number
) {
  const [ymin, xmin, ymax, xmax] = bbox
  return {
    x: (xmin / 1000) * containerWidth,
    y: (ymin / 1000) * containerHeight,
    width: ((xmax - xmin) / 1000) * containerWidth,
    height: ((ymax - ymin) / 1000) * containerHeight,
  }
}

// ── Status Colors ─────────────────────────────────
const STATUS_COLORS = {
  correct: '#10b981',
  partial: '#f59e0b',
  wrong: '#ef4444',
}

// ── Digital Teacher Desk Component ────────────────
export function DigitalDesk({
  imageUrl,
  naturalWidth = 800,
  naturalHeight = 1123,
  overlays = [],
  teacherName,
  onScoreChange,
  onAnnotationAdd,
}: DigitalDeskProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<'select' | 'pen' | 'highlight' | 'text'>('select')
  const [freehandPoints, setFreehandPoints] = useState<number[]>([])
  // PATCH v1.16: basınç destekli noktalar [x, y, pressure][]
  const [pressurePoints, setPressurePoints] = useState<number[][]>([])

  // Responsive container sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        const ratio = naturalHeight / naturalWidth
        setDimensions({
          width: Math.min(width, 1200),
          height: Math.min(width * ratio, 900),
        })
      }
    })

    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [naturalWidth, naturalHeight])

  // Handle score edit click
  const handleScoreClick = useCallback(
    (questionNo: number) => {
      setSelectedQuestion(questionNo === selectedQuestion ? null : questionNo)
    },
    [selectedQuestion]
  )

  // Handle score change
  const handleScoreChange = useCallback(
    (questionNo: number, newScore: number, maxScore: number) => {
      const clamped = Math.max(0, Math.min(maxScore, newScore))
      onScoreChange?.(questionNo, clamped)
    },
    [onScoreChange]
  )

  // Freehand drawing handlers — PATCH v1.16: Pointer Events pressure (Apple Pencil/stylus)
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool !== 'pen') return
      setIsDrawing(true)
      const pos = e.target.getStage()?.getPointerPosition()
      // e.evt.pressure: 0-1 (stylus gerçek basınç, fare 0.5 verir)
      const pressure = (e.evt as any).pressure ?? 0.5
      if (pos) {
        setFreehandPoints([pos.x, pos.y])
        setPressurePoints([[pos.x, pos.y, pressure || 0.5]])
      }
    },
    [tool]
  )

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing || tool !== 'pen') return
      const pos = e.target.getStage()?.getPointerPosition()
      const pressure = (e.evt as any).pressure ?? 0.5
      if (pos) {
        setFreehandPoints((prev) => [...prev, pos.x, pos.y])
        setPressurePoints((prev) => [...prev, [pos.x, pos.y, pressure || 0.5]])
      }
    },
    [isDrawing, tool]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || tool !== 'pen') return
    setIsDrawing(false)
    if (pressurePoints.length >= 2) {
      // perfect-freehand ile basınca duyarlı outline üret
      const outlinePoints = strokeToFlatPoints(pressurePoints)
      const annotation: Annotation = {
        id: `pen_${Date.now()}`,
        type: 'freehand',
        points: outlinePoints,
        color: '#f59e0b',
        strokeWidth: 2,
      }
      setAnnotations((prev) => [...prev, annotation])
      onAnnotationAdd?.(annotation)
    }
    setFreehandPoints([])
    setPressurePoints([])
  }, [isDrawing, tool, pressurePoints, onAnnotationAdd])

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded-lg">
        <ToolButton active={tool === 'select'} onClick={() => setTool('select')} label="↖ Seç" />
        <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} label="✏️ Kalem" />
        <ToolButton active={tool === 'highlight'} onClick={() => setTool('highlight')} label="🖍 Vurgula" />
        <ToolButton active={tool === 'text'} onClick={() => setTool('text')} label="📝 Not" />
        <div className="ml-auto text-xs text-slate-400">
          {teacherName ? `${teacherName} · ` : ''}{overlays.filter(o => o.status !== 'correct').length} hata
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-xl overflow-hidden"
        style={{ height: dimensions.height }}
      >
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: tool === 'pen' ? 'crosshair' : 'default' }}
        >
          <Layer>
            {/* Exam page image */}
            <KonvaImage
              image={useImageLoader(imageUrl ?? '')}
              width={dimensions.width}
              height={dimensions.height}
            />

            {/* AI Score Overlays */}
            {overlays.map((overlay) => {
              const rect = bboxToPixels(overlay.bbox, dimensions.width, dimensions.height)
              const color = STATUS_COLORS[overlay.status]
              const isSelected = selectedQuestion === overlay.questionNo

              return (
                <Group key={overlay.questionNo}>
                  {/* Question bounding box */}
                  <Rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 1.5}
                    strokeScaleEnabled={false}
                    cornerRadius={4}
                    opacity={isSelected ? 0.9 : 0.6}
                    onClick={() => handleScoreClick(overlay.questionNo)}
                    onTap={() => handleScoreClick(overlay.questionNo)}
                  />

                  {/* Score badge */}
                  <Group
                    x={rect.x + rect.width - 50}
                    y={rect.y - 22}
                    onClick={() => handleScoreClick(overlay.questionNo)}
                    onTap={() => handleScoreClick(overlay.questionNo)}
                  >
                    <Rect
                      width={50}
                      height={20}
                      fill={color}
                      cornerRadius={4}
                      opacity={0.9}
                    />
                    <Text
                      x={25}
                      y={10}
                      text={`${overlay.score}/${overlay.maxScore}`}
                      fontSize={11}
                      fill="white"
                      fontStyle="bold"
                      align="center"
                      verticalAlign="middle"
                      offsetX={25}
                      offsetY={10}
                    />
                  </Group>

                  {/* Status icon */}
                  <Circle
                    x={rect.x - 12}
                    y={rect.y + rect.height / 2}
                    radius={10}
                    fill={color}
                    opacity={0.9}
                  />
                  <Text
                    x={rect.x - 12}
                    y={rect.y + rect.height / 2}
                    text={overlay.status === 'correct' ? '✓' : overlay.status === 'partial' ? '~' : '✗'}
                    fontSize={12}
                    fill="white"
                    fontStyle="bold"
                    align="center"
                    verticalAlign="middle"
                    offsetX={6}
                    offsetY={6}
                  />
                </Group>
              )
            })}

            {/* Teacher annotations — PATCH v1.16: perfect-freehand outline (closed+fill) */}
            {annotations.map((ann) => {
              if (ann.type === 'freehand' && ann.points) {
                return (
                  <Line
                    key={ann.id}
                    points={ann.points}
                    fill={ann.color}
                    closed={true}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation="source-over"
                  />
                )
              }
              return null
            })}

            {/* Current freehand drawing — basınca duyarlı canlı önizleme */}
            {isDrawing && pressurePoints.length >= 2 && (
              <Line
                points={strokeToFlatPoints(pressurePoints)}
                fill="#f59e0b"
                closed={true}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* Score edit modal (inline) */}
            {selectedQuestion && (
              <ScoreEditPopup
                overlay={overlays.find((o) => o.questionNo === selectedQuestion)!}
                onSave={(newScore) => {
                  const overlay = overlays.find((o) => o.questionNo === selectedQuestion)
                  if (overlay) {
                    handleScoreChange(selectedQuestion, newScore, overlay.maxScore)
                  }
                  setSelectedQuestion(null)
                }}
                onClose={() => setSelectedQuestion(null)}
                stageWidth={dimensions.width}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────

function ToolButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

function ScoreEditPopup({
  overlay,
  onSave,
  onClose,
  stageWidth,
}: {
  overlay: ScoreOverlay
  onSave: (score: number) => void
  onClose: () => void
  stageWidth: number
}) {
  const [editScore, setEditScore] = useState(overlay.score)
  const rect = bboxToPixels(overlay.bbox, stageWidth, 600)

  return (
    <Group x={Math.max(10, Math.min(rect.x, stageWidth - 220))} y={Math.max(0, rect.y - 80)}>
      {/* Popup background */}
      <Rect width={200} height={70} fill="#1e293b" cornerRadius={8} shadowColor="black" shadowBlur={10} shadowOpacity={0.5} />
      <Rect width={200} height={70} stroke="#3b82f6" strokeWidth={1} cornerRadius={8} />

      {/* AI explanation */}
      <Text x={10} y={8} text={overlay.explanation} fontSize={10} fill="#94a3b8" width={180} />

      {/* Score slider area */}
      <Text x={10} y={28} text={`Puan:`} fontSize={12} fill="white" fontStyle="bold" />
      <Rect x={50} y={26} width={70} height={20} fill="#0f172a" cornerRadius={4} />
      <Text
        x={85}
        y={36}
        text={`${editScore}`}
        fontSize={14}
        fill="white"
        fontStyle="bold"
        align="center"
        verticalAlign="middle"
        offsetX={editScore >= 10 ? 8 : 4}
        offsetY={7}
      />

      {/* + / - buttons */}
      <Rect x={124} y={26} width={20} height={20} fill="#3b82f6" cornerRadius={4} onClick={() => setEditScore(Math.min(overlay.maxScore, editScore + 1))} />
      <Text x={134} y={36} text="+" fontSize={14} fill="white" fontStyle="bold" align="center" verticalAlign="middle" offsetX={6} offsetY={7} />
      <Rect x={148} y={26} width={20} height={20} fill="#ef4444" cornerRadius={4} onClick={() => setEditScore(Math.max(0, editScore - 1))} />
      <Text x={158} y={36} text="-" fontSize={14} fill="white" fontStyle="bold" align="center" verticalAlign="middle" offsetX={5} offsetY={7} />

      {/* Save button */}
      <Rect x={172} y={26} width={22} height={20} fill="#10b981" cornerRadius={4} onClick={() => onSave(editScore)} />
      <Text x={183} y={36} text="✓" fontSize={14} fill="white" fontStyle="bold" align="center" verticalAlign="middle" offsetX={7} offsetY={7} />
    </Group>
  )
}

// ── Image Loader Hook ────────────────────────────
function useImageLoader(url: string): HTMLImageElement {
  const [image, setImage] = useState(new Image())

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.src = url
    return () => {
      img.onload = null
    }
  }, [url])

  return image
}

// ════════════════════════════════════════════════════════════════════
// v1.14 — TEACHER TRUST: Rubric/Explanation Panel + Source Badge
// Öğretmenin puanlama gerekçesini görmesi için kritik.
// Madde 6: "answer_key → rubric → AI → teacher" zinciri görünür.
// ════════════════════════════════════════════════════════════════════

const SOURCE_LABELS: Record<NonNullable<ScoreOverlay['source']>, { label: string; color: string; icon: string }> = {
  answer_key: { label: 'Cevap Anahtarı', color: '#10b981', icon: '🔑' },
  rubric:     { label: 'Rubrik',          color: '#3b82f6', icon: '📋' },
  ai_heuristic: { label: 'AI Tahmini',   color: '#f59e0b', icon: '🤖' },
}

/**
 * Soru bazlı rubrik + açıklama paneli.
 * DeskPage'de ScoreOverlay seçildiğinde yan panelde gösterilir.
 * Öğretmen "neden bu puan verildi?" sorusuna cevap alır.
 */
export function ExplanationPanel({
  overlay,
  onClose,
}: {
  overlay: ScoreOverlay | null
  onClose: () => void
}) {
  if (!overlay) return null

  const sourceInfo = overlay.source ? SOURCE_LABELS[overlay.source] : null
  const confPct = overlay.confidence != null ? Math.round(overlay.confidence * 100) : null
  const confColor = overlay.confidence != null
    ? overlay.confidence >= 0.85 ? '#10b981'
      : overlay.confidence >= 0.70 ? '#f59e0b' : '#ef4444'
    : '#94a3b8'

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 text-sm">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-white">
          S{overlay.questionNo} — {overlay.score}/{overlay.maxScore} puan
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-lg leading-none"
        >✕</button>
      </div>

      {/* Kaynak rozeti (Madde 6 zinciri) */}
      {sourceInfo && (
        <div
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold"
          style={{ backgroundColor: `${sourceInfo.color}22`, color: sourceInfo.color }}
        >
          {sourceInfo.icon} {sourceInfo.label}
        </div>
      )}

      {/* AI açıklaması */}
      {overlay.explanation && (
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-slate-300 leading-relaxed">{overlay.explanation}</p>
        </div>
      )}

      {/* Rubrik detayı */}
      {overlay.rubricScores && overlay.rubricScores.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-slate-400 font-medium text-xs uppercase tracking-wide">Rubrik Detayı</p>
          {overlay.rubricScores.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-700/40 rounded px-3 py-1.5">
              <span className="text-slate-300 text-xs">{r.criterion}</span>
              <span className="font-bold text-xs" style={{
                color: r.awarded >= r.max ? '#10b981' : r.awarded > 0 ? '#f59e0b' : '#ef4444'
              }}>
                {r.awarded}/{r.max}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Güven skoru (ısı haritası rengi) */}
      {confPct != null && (
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs">OCR Güveni:</span>
          <span className="font-bold text-xs" style={{ color: confColor }}>
            %{confPct}
          </span>
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${confPct}%`, backgroundColor: confColor }}
            />
          </div>
        </div>
      )}

      {/* Kural 12 uyarısı */}
      {overlay.reviewRequired && (
        <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2">
          <span className="text-amber-400 text-base">⚠</span>
          <span className="text-amber-300 text-xs font-medium">
            Öğretmen incelemesi gerekli (düşük güven)
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Tüm sorular için özet istatistik — onboarding / review ekranında da kullanılır.
 */
export function GradingSummaryPanel({
  overlays,
  onBulkApprove,
}: {
  overlays: ScoreOverlay[]
  onBulkApprove?: (approvedNos: number[]) => void
}) {
  const total = overlays.reduce((s, o) => s + o.score, 0)
  const maxTotal = overlays.reduce((s, o) => s + o.maxScore, 0)
  const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0
  const needsReview = overlays.filter(o => o.reviewRequired)
  const bySource = {
    answer_key: overlays.filter(o => o.source === 'answer_key').length,
    rubric: overlays.filter(o => o.source === 'rubric').length,
    ai_heuristic: overlays.filter(o => o.source === 'ai_heuristic').length,
  }
  const highConf = overlays.filter(o => (o.confidence ?? 0) >= 0.85)

  const handleBulkApprove = () => {
    const approvedNos = highConf.map(o => o.questionNo)
    onBulkApprove?.(approvedNos)
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
      {/* Toplam puan */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-emerald-400">{total}</span>
        <span className="text-slate-400">/ {maxTotal} puan</span>
        <span className="ml-auto text-lg font-bold text-white">%{pct}</span>
      </div>

      {/* Madde 6 zinciri dağılımı */}
      <div className="space-y-1.5">
        <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">
          Puanlama Zinciri (Madde 6)
        </p>
        {bySource.answer_key > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span>🔑</span>
            <span className="text-emerald-400 font-semibold">{bySource.answer_key}</span>
            <span className="text-slate-400">soru cevap anahtarından</span>
          </div>
        )}
        {bySource.rubric > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span>📋</span>
            <span className="text-blue-400 font-semibold">{bySource.rubric}</span>
            <span className="text-slate-400">soru rubrikten</span>
          </div>
        )}
        {bySource.ai_heuristic > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span>🤖</span>
            <span className="text-amber-400 font-semibold">{bySource.ai_heuristic}</span>
            <span className="text-slate-400">soru AI tahmininden</span>
          </div>
        )}
      </div>

      {/* İnceleme bekleyen */}
      {needsReview.length > 0 && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2">
          <p className="text-amber-300 text-xs font-medium">
            ⚠ {needsReview.length} soru öğretmen incelemesi bekliyor
          </p>
          <p className="text-amber-500 text-xs mt-0.5">
            S{needsReview.map(o => o.questionNo).join(', S')}
          </p>
        </div>
      )}

      {/* Toplu onay butonu (v1.10'dan) */}
      {onBulkApprove && highConf.length > 0 && (
        <button
          onClick={handleBulkApprove}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors"
        >
          ✅ {highConf.length} soruyu toplu onayla (yüksek güven)
        </button>
      )}
    </div>
  )
}
