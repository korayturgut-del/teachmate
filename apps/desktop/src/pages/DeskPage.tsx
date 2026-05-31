/**
 * apps/desktop/src/pages/DeskPage.tsx — v1.14 Teacher Trust
 * ADR-004: Yalnızca /desk route'unda — Konva.js Fabric.js ile asla eşzamanlı değil.
 * v1.14: ExplanationPanel + GradingSummaryPanel + toplu onay entegrasyonu.
 */
import React, { useState } from 'react'
import { DigitalDesk, ExplanationPanel, GradingSummaryPanel } from '../components/desk/digital-desk'
import type { ScoreOverlay } from '../components/desk/digital-desk'
import type { GradedQuestion } from '../lib/pipeline'

interface DeskPageProps {
  detected?: {
    studentName?: string
    studentNo?: string
    className?: string
    subject?: string
    examType?: string
    school?: string
  }
  totalPages?: number
  /** v1.14: gradeFullExam'dan gelen sonuç — rubrik + kaynak gösterimi için */
  gradedQuestions?: GradedQuestion[]
  imageUrl?: string
}

/** GradedQuestion → ScoreOverlay dönüşümü (pipeline → UI köprüsü) */
function gradedToOverlay(q: GradedQuestion, idx: number): ScoreOverlay {
  const status: ScoreOverlay['status'] =
    q.ai_score >= q.max_score ? 'correct'
    : q.ai_score <= 0 ? 'wrong'
    : 'partial'

  return {
    questionNo: q.question_no,
    score: q.ai_score,
    maxScore: q.max_score,
    status,
    bbox: [idx * 200, 0, (idx + 1) * 200, 1000], // Placeholder — gerçekte question-segmentation
    explanation: q.explanation,
    source: q.source,
    confidence: q.confidence,
    reviewRequired: q.review_required,
  }
}

const DeskPage: React.FC<DeskPageProps> = ({
  detected,
  totalPages = 1,
  gradedQuestions = [],
  imageUrl,
}) => {
  const [selectedOverlay, setSelectedOverlay] = useState<ScoreOverlay | null>(null)
  const [overlays, setOverlays] = useState<ScoreOverlay[]>(
    () => gradedQuestions.map(gradedToOverlay)
  )

  const handleScoreChange = (questionNo: number, newScore: number) => {
    setOverlays(prev => prev.map(o =>
      o.questionNo === questionNo
        ? { ...o, score: newScore,
            status: newScore >= o.maxScore ? 'correct' : newScore <= 0 ? 'wrong' : 'partial' }
        : o
    ))
  }

  const handleBulkApprove = (approvedNos: number[]) => {
    // v1.10 toplu onay — yüksek güvenli sorular otomatik kabul
    // GradeOverridden üretilmez (öğretmen değiştirmedi, onayladı)
    console.log('[v1.10 bulk approve]', approvedNos)
  }

  return (
    <div className="max-w-7xl mx-auto p-4 flex gap-4">
      {/* Sol: Konva canvas */}
      <div className="flex-1 min-w-0">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">🖥 Dijital Masa</h2>
            {detected?.studentName && (
              <p className="text-sm text-slate-400">
                {detected.studentName}
                {detected.className && ` · ${detected.className}`}
                {detected.subject && ` · ${detected.subject}`}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-500">Sayfa 1/{totalPages}</span>
        </div>

        <DigitalDesk
          imageUrl={imageUrl}
          overlays={overlays}
          onScoreChange={handleScoreChange}
          onAnnotationAdd={(ann) => console.log('[annotation]', ann)}
        />
      </div>

      {/* Sağ: Açıklama + Özet paneli */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* Seçili soru açıklaması */}
        {selectedOverlay ? (
          <ExplanationPanel
            overlay={selectedOverlay}
            onClose={() => setSelectedOverlay(null)}
          />
        ) : (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <p className="text-slate-500 text-sm">
              Soru kutusuna tıklayın<br />rubrik ve açıklamayı görün
            </p>
          </div>
        )}

        {/* Genel özet + toplu onay */}
        {overlays.length > 0 && (
          <GradingSummaryPanel
            overlays={overlays}
            onBulkApprove={handleBulkApprove}
          />
        )}
      </div>
    </div>
  )
}

export default DeskPage
