// @/components/exam/archive-browser.tsx
// Archive Browser — search, filter, view student exam history

import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────
interface ArchiveRecord {
  id: number
  exam_id?: number
  student_name: string
  student_no: string
  subject: string
  score: number
  max_score: number
  page_count: number
  r2_pdf_key: string
  archived_at: string
  class_name?: string
  year?: string
  period?: string
  metadata?: Record<string, unknown>
}

interface StudentHistory {
  student_id: number
  student_name: string
  student_no: string
  class_name: string
  exams: ArchiveRecord[]
  total_exams: number
  average_score: number
  grade_trend: { exam_no: number; score: number; date: string }[]
}

interface ArchiveSearchParams {
  query: string
  school_id: number
  year?: string
  class_name?: string
  subject?: string
  student_name?: string
  page: number
  limit: number
}

// ── Score Color Helper ───────────────────────────
function scoreColor(score: number, max: number = 100): string {
  const pct = (score / max) * 100
  if (pct >= 85) return 'text-emerald-400'
  if (pct >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBg(score: number, max: number = 100): string {
  const pct = (score / max) * 100
  if (pct >= 85) return 'bg-emerald-500/20'
  if (pct >= 50) return 'bg-amber-500/20'
  return 'bg-red-500/20'
}

// ── Archive Browser Component ─────────────────────
export function ArchiveBrowser({ schoolId = 1, onEdit }: { schoolId?: number; onEdit?: (examId: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [records, setRecords] = useState<ArchiveRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentHistory | null>(null)
  const [filterYear, setFilterYear] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [showSearch, setShowSearch] = useState(true)

  const searchArchive = useCallback(async (params: Partial<ArchiveSearchParams>) => {
    setLoading(true)
    try {
      const response = await fetch('/api/archive/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: params.query || '',
          school_id: params.school_id || schoolId,
          year: params.year || filterYear,
          class_name: params.class_name || filterClass,
          page: params.page || 1,
          limit: 50,
        }),
      })
      const data = await response.json()
      setRecords(data.results || [])
    } catch (err) {
      console.error('Archive search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [schoolId, filterYear, filterClass])

  const loadStudentHistory = useCallback(async (studentNo: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/archive/student/${studentNo}`)
      const data = await response.json()
      setSelectedStudent(data)
      setShowSearch(false)
    } catch (err) {
      console.error('Student history load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    searchArchive({ query: '', school_id: schoolId })
  }, [schoolId, searchArchive])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">🗄 Arşiv</h2>
          <p className="text-xs text-slate-400">{records.length} kayıt bulundu</p>
        </div>
        <button
          onClick={() => { setShowSearch(!showSearch); setSelectedStudent(null) }}
          className="px-3 py-1.5 text-xs font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-600"
        >
          {showSearch ? 'Liste' : 'Ara'}
        </button>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="🔍 Öğrenci adı, numarası, ders ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchArchive({ query: searchQuery })}
            className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={filterYear}
            onChange={(e) => { setFilterYear(e.target.value); searchArchive({ query: searchQuery, year: e.target.value }) }}
            className="px-2 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="">Tüm yıllar</option>
            <option value="2025/2026">2025/2026</option>
            <option value="2024/2025">2024/2025</option>
          </select>
        </div>
      )}

      {/* Student History Detail */}
      {selectedStudent && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-white">{selectedStudent.student_name}</h3>
              <p className="text-xs text-slate-400">
                No: {selectedStudent.student_no} · {selectedStudent.class_name}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{selectedStudent.average_score}</div>
              <div className="text-xs text-slate-400">Ortalama</div>
            </div>
          </div>

          {/* Grade Trend */}
          {selectedStudent.grade_trend.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">Sınav Trendi</div>
              <div className="flex gap-1 items-end h-16">
                {selectedStudent.grade_trend.map((g, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(g.score / 100) * 48}px`,
                        backgroundColor: g.score >= 85 ? '#10b981' : g.score >= 50 ? '#f59e0b' : '#ef4444',
                        opacity: 0.8,
                      }}
                    />
                    <span className="text-[10px] text-slate-500">{g.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setSelectedStudent(null)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            ← Geri dön
          </button>
        </div>
      )}

      {/* Record List */}
      {!selectedStudent && (
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Yükleniyor...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <div className="text-3xl mb-2">📭</div>
              <p>Henüz arşiv kaydı yok</p>
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => loadStudentHistory(record.student_no)}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg shrink-0">
                  {record.student_name.charAt(0).toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm truncate">
                    {record.student_name || 'İsimsiz'}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    No: {record.student_no} · {record.subject || 'Belirtilmemiş'}
                    {record.class_name ? ` · ${record.class_name}` : ''}
                  </div>
                </div>

                {/* Score */}
                <div className={`text-right ${scoreColor(record.score, record.max_score)}`}>
                  <div className="font-bold text-sm">
                    {record.score}/{record.max_score}
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${scoreBg(record.score, record.max_score)}`}>
                    {record.archived_at?.slice(0, 10) || '-'}
                  </div>
                </div>

                {/* PATCH v1.16 — Arşivden çıkar + masada tekrar düzenle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onEdit) onEdit(String(record.exam_id ?? record.id))
                  }}
                  className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium"
                  title="Dijital masada tekrar düzenle"
                >
                  ✏️ Düzenle
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
