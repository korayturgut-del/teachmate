// @/components/exam/school-management.tsx
// School Management — class list, student roster, grade dashboard

import { useState, useEffect, useCallback } from 'react'

interface Student {
  id: number
  school_no: string
  name: string
  class_name: string
  grade_level: number
  exam_count: number
  average_score: number
}

interface GradeSummary {
  student_id: number
  student_name: string
  yazili_1?: number
  yazili_2?: number
  performans?: number
  proje?: number
  average?: number
}

interface ClassStats {
  class_name: string
  student_count: number
  average_score: number
  highest_score: number
  lowest_score: number
  median_score: number
  score_distribution: Record<string, number>
}

// ── Helpers ───────────────────────────────────────
function gradeColor(v?: number): string {
  if (v === undefined || v === null) return 'text-slate-500'
  if (v >= 85) return 'text-emerald-400'
  if (v >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function gradeBg(v?: number): string {
  if (v === undefined || v === null) return 'bg-slate-800'
  if (v >= 85) return 'bg-emerald-500/10'
  if (v >= 50) return 'bg-amber-500/10'
  return 'bg-red-500/10'
}

// ── School Management Component ───────────────────
export function SchoolManagement({ schoolId = 1 }: { schoolId?: number }) {
  const [classes, setClasses] = useState<string[]>([])
  const [activeClass, setActiveClass] = useState('')
  const [students, setStudents] = useState<GradeSummary[]>([])
  const [stats, setStats] = useState<ClassStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'grades' | 'stats'>('grades')

  // Load class list
  useEffect(() => {
    fetch(`/api/school/classes/${schoolId}`)
      .then(r => r.json())
      .then(d => { setClasses(d.classes || []); if (d.classes?.length) setActiveClass(d.classes[0]) })
      .catch(() => {})
  }, [schoolId])

  // Load grades for active class
  const loadClassData = useCallback(async (className: string) => {
    if (!className) return
    setLoading(true)
    try {
      const [gradesRes, statsRes] = await Promise.all([
        fetch(`/api/school/class/${encodeURIComponent(className)}/grades/${schoolId}`),
        fetch(`/api/analytics/class/${encodeURIComponent(className)}/${schoolId}`),
      ])
      if (gradesRes.ok) setStudents(await gradesRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } catch (err) {
      console.error('Class data load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => { loadClassData(activeClass) }, [activeClass, loadClassData])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">🏫 Okul Yönetimi</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${activeTab === 'grades' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >Notlar</button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${activeTab === 'stats' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >İstatistik</button>
        </div>
      </div>

      {/* Class tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {classes.map(cls => (
          <button
            key={cls}
            onClick={() => setActiveClass(cls)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-full transition-colors ${
              activeClass === cls
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {cls}
          </button>
        ))}
        {classes.length === 0 && (
          <span className="text-xs text-slate-500 py-1">Henüz sınıf oluşturulmamış</span>
        )}
      </div>

      {activeTab === 'grades' && (
        <>
          {/* Grade Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs">
                  <th className="text-left py-2 px-2 font-medium">No</th>
                  <th className="text-left py-2 px-2 font-medium">Öğrenci</th>
                  <th className="text-center py-2 px-2 font-medium">1.Yazılı</th>
                  <th className="text-center py-2 px-2 font-medium">2.Yazılı</th>
                  <th className="text-center py-2 px-2 font-medium">Performans</th>
                  <th className="text-center py-2 px-2 font-medium">Proje</th>
                  <th className="text-center py-2 px-2 font-medium">Ort.</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-500">Yükleniyor...</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-500">Bu sınıfta öğrenci yok</td></tr>
                ) : (
                  students.map((s, i) => (
                    <tr key={s.student_id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-2.5 px-2 text-slate-400 text-xs">{i + 1}</td>
                      <td className="py-2.5 px-2 font-medium text-white">{s.student_name}</td>
                      <td className={`py-2.5 px-2 text-center font-bold ${gradeColor(s.yazili_1)}`}>
                        {s.yazili_1 ?? '—'}
                      </td>
                      <td className={`py-2.5 px-2 text-center font-bold ${gradeColor(s.yazili_2)}`}>
                        {s.yazili_2 ?? '—'}
                      </td>
                      <td className={`py-2.5 px-2 text-center font-bold ${gradeColor(s.performans)}`}>
                        {s.performans ?? '—'}
                      </td>
                      <td className={`py-2.5 px-2 text-center font-bold ${gradeColor(s.proje)}`}>
                        {s.proje ?? '—'}
                      </td>
                      <td className={`py-2.5 px-2 text-center font-bold text-lg ${gradeColor(s.average)}`}>
                        {s.average ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Statistics tab */}
      {activeTab === 'stats' && stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Öğrenci Sayısı" value={stats.student_count} />
          <StatCard label="Sınıf Ortalaması" value={stats.average_score} color={stats.average_score >= 85 ? 'emerald' : stats.average_score >= 50 ? 'amber' : 'red'} />
          <StatCard label="En Yüksek" value={stats.highest_score} color="emerald" />
          <StatCard label="En Düşük" value={stats.lowest_score} color="red" />
          <div className="col-span-2 bg-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-2">Puan Dağılımı</div>
            <div className="flex gap-1 items-end h-20">
              {Object.entries(stats.score_distribution).map(([range, count]) => (
                <div key={range} className="flex flex-col items-center gap-1 flex-1">
                  <div className="text-[10px] text-slate-400">{count}</div>
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${Math.max(4, (count / Math.max(...Object.values(stats.score_distribution))) * 60)}px`,
                      backgroundColor: range.startsWith('90') ? '#10b981' : range.startsWith('70') ? '#3b82f6' : range.startsWith('50') ? '#f59e0b' : '#ef4444',
                      opacity: 0.7,
                    }}
                  />
                  <div className="text-[9px] text-slate-500">{range}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color = 'blue' }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  }
  return (
    <div className="bg-slate-800 rounded-xl p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[color] || 'text-white'}`}>{value}</div>
    </div>
  )
}
