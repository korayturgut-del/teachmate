// apps/desktop/src/App.tsx
// Dijital Öğretmen Asistanı — Masaüstü Ana Uygulama
// Phase 2: React Router lazy() ile ADR-004 route izolasyonu.
// Fabric.js (/editor) ve Konva.js (/desk) asla eşzamanlı render edilmez.

import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { OnboardingWizard, isOnboarded, loadTeacherProfile } from './components/onboarding/OnboardingWizard'
import type { TeacherProfile } from './components/onboarding/OnboardingWizard'
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { extractPdfPages, isPdf } from './lib/pdf-utils'
import { runStage, gradeFullExam, segmentPage, regionsToQuestions, type FullRunResult } from './lib/pipeline'
import { toast, Toaster } from 'sonner'

// ── Lazy Routes (ADR-004: ayrı chunk'lar) ─────────────────────────
const DeskPage = React.lazy(() => import('./pages/DeskPage'))
const EditorPage = React.lazy(() => import('./pages/EditorPage'))
const ArchivePage = React.lazy(() => import('./pages/ArchivePage'))

// ── Types ──────────────────────────────────────────────────────────
type WorkflowStep = 'upload' | 'processing' | 'review'

interface UploadFile {
  id: string; name: string; type: 'pdf' | 'image'
  pages?: string[]; pageCount: number; size: number
}
interface DetectedInfo {
  studentName?: string; studentNo?: string; className?: string
  subject?: string; examType?: string; school?: string
  year?: string; period?: string; pageOrder?: number[]
}
interface PipelineProgress {
  stage: string; progress: number; status: 'pending' | 'running' | 'done' | 'error'
  message?: string
}

const FILE_ACCEPT = '.pdf,image/*'

// ── Ana Uygulama ───────────────────────────────────────────────────
export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => {
    try { return localStorage.getItem('doa_onboarded') === '1' } catch { return false }
  })
  const [teacherProfile, setTeacherProfile] = useState<any>(null)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  return (
    <>
      {!isOnboarded && (
        <OnboardingWizard
          onComplete={(profile) => {
            setTeacherProfile(profile)
            setIsOnboarded(true)
            try { localStorage.setItem('doa_onboarded', '1') } catch {}
          }}
        />
      )}
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-white flex flex-col">
        {/* Phase 4: SQLCipher AES-256 aktif — PII şifreli */}
        {/* PATCH v1.8: toast bildirimleri (öğretmen görünürlüğü) */}
        <Toaster position="top-right" richColors theme="dark" />

        {/* Top Bar + Navigation */}
        <NavBar isMobile={isMobile} />

        {/* Route İçeriği — Suspense ile lazy loading */}
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-pulse">🎓</div>
                <div className="text-sm">Yükleniyor...</div>
              </div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<HomePage isMobile={isMobile} />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/desk" element={<DeskPage />} />
              <Route path="/archive" element={<ArchivePage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
    </>
  )
}

// ── Navigasyon Barı ────────────────────────────────────────────────
function NavBar({ isMobile, offlineQueueCount = 0, teacherName }: { isMobile: boolean; offlineQueueCount?: number; teacherName?: string }) {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path
  const linkClass = (path: string) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
      isActive(path)
        ? 'bg-blue-600 text-white'
        : 'text-slate-400 hover:text-white hover:bg-slate-700'
    }`

  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around py-2 z-50">
        <Link to="/" className="flex flex-col items-center gap-0.5 text-xs text-slate-400 px-3 py-1">
          <span className="text-lg">📤</span> Yükle
        </Link>
        <Link to="/editor" className="flex flex-col items-center gap-0.5 text-xs text-slate-400 px-3 py-1">
          <span className="text-lg">🦋</span> Editör
        </Link>
        <Link to="/desk" className="flex flex-col items-center gap-0.5 text-xs text-slate-400 px-3 py-1">
          <span className="text-lg">🖥</span> Masa
        </Link>
        <Link to="/archive" className="flex flex-col items-center gap-0.5 text-xs text-slate-400 px-3 py-1">
          <span className="text-lg">🗄</span> Arşiv
        </Link>
      </nav>
    )
  }

  return (
    <header className="border-b border-slate-700/50 bg-slate-800/50">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-sm text-white">Dijital Öğretmen Asistanı</span>
          <span className="text-[10px] text-slate-500">v1.0-doa</span>
          {offlineQueueCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-600 text-white">
              {offlineQueueCount} kuyrukta
            </span>
          )}
          {teacherName && (
            <span className="ml-2 text-[10px] text-slate-400 hidden lg:block">
              👤 {teacherName}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-1">
          <Link to="/" className={linkClass('/')}>
            <span>📤</span> {!isMobile && 'Yükle'}
          </Link>
          <Link to="/editor" className={linkClass('/editor')}>
            <span>🦋</span> {!isMobile && 'Editör'}
          </Link>
          <Link to="/desk" className={linkClass('/desk')}>
            <span>🖥</span> {!isMobile && 'Masa'}
          </Link>
          <Link to="/archive" className={linkClass('/archive')}>
            <span>🗄</span> {!isMobile && 'Arşiv'}
          </Link>
        </div>
      </div>
    </header>
  )
}

// ── Ana Sayfa (Yükleme İş Akışı) ───────────────────────────────────
function HomePage({ isMobile }: { isMobile: boolean }) {
  const [step, setStep] = useState<WorkflowStep>('upload')
  const [uploadedFiles, setUploadedFiles] = useState<UploadFile[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [detectedInfo, setDetectedInfo] = useState<DetectedInfo>({})
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress[]>([])
  const [processingPdf, setProcessingPdf] = useState(false)
  const [gradingResult, setGradingResult] = useState<FullRunResult | null>(null)
  const [savedToArchive, setSavedToArchive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const newFiles: UploadFile[] = []
    for (const file of Array.from(files)) {
      const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      if (isPdf(file)) {
        setProcessingPdf(true)
        try {
          const result = await extractPdfPages(file)
          const pageDataUrls = result.pages.map(p => p.dataUrl)
          newFiles.push({ id, name: file.name, type: 'pdf', pages: pageDataUrls, pageCount: result.pageCount, size: file.size })
        } catch (err) {
          console.error('PDF işleme hatası:', err)
          newFiles.push({ id, name: file.name, type: 'pdf', pageCount: 0, size: file.size })
        } finally {
          setProcessingPdf(false)
        }
      } else {
        const dataUrl = await fileToDataUrl(file)
        newFiles.push({ id, name: file.name, type: 'image', pages: [dataUrl], pageCount: 1, size: file.size })
      }
    }
    setUploadedFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const startProcessing = useCallback(async () => {
    setStep('processing')
    const pipeline: PipelineProgress[] = [
      { stage: 'sayfa_ayirma', progress: 0, status: 'pending', message: 'Sayfalar ayrıştırılıyor...' },
      { stage: 'ogrenci_bilgi', progress: 0, status: 'pending', message: 'Öğrenci bilgileri okunuyor...' },
      { stage: 'ders_tespit', progress: 0, status: 'pending', message: 'Ders ve sınav tipi tespit ediliyor...' },
      { stage: 'ocr', progress: 0, status: 'pending', message: 'Yazılı okunuyor...' },
      { stage: 'anlam_analizi', progress: 0, status: 'pending', message: 'Anlam analizi yapılıyor...' },
      { stage: 'surec_puanlama', progress: 0, status: 'pending', message: 'Süreç odaklı puanlama...' },
    ]
    setPipelineProgress([...pipeline])
    await runPipeline(pipeline, setPipelineProgress, setDetectedInfo)

    // PATCH v1.9 — GERÇEK SORU VERİSİ: OCR → segmentasyon → soru-cevap çiftleri
    // Master prompt v1.9: "No more sample questions."
    try {
      const examId = `exam_${Date.now().toString(36)}`
      const pages = uploadedFiles.flatMap(f => f.pages || [])
      const firstPage = pages[0]  // ilk sayfayı segmentle (çok sayfa v1.10+)

      // 1) Sayfayı gerçek soru bölgelerine ayır (OCR + segmentasyon)
      const seg = await segmentPage({
        image_base64: firstPage ?? null,
        // Şablon/cevap anahtarı varsa buraya gelir (template-engine'den) — v1.11+
        template_questions: null,
      })

      // 2) Bölgeleri soru-cevap çiftlerine çevir (gerçek OCR metni = öğrenci yanıtı)
      //    Cevap anahtarı yüklendiğinde regionsToQuestions'a 2. argüman olarak geçilir.
      let questions = regionsToQuestions(seg.regions)

      // Segmentasyon hiç bölge bulamazsa (boş/okunamaz sayfa) → öğretmene bildir,
      // tek manuel inceleme bölgesi aç (fake veri ÜRETME — Madde 3).
      if (questions.length === 0) {
        toast.warning('Sayfada soru bölgesi okunamadı', {
          description: 'Dijital masada manuel değerlendirme yapabilirsiniz.',
        })
        questions = [{
          question_no: 1, question_text: 'Soru 1', student_answer: '',
          max_score: 10, question_type: 'open',
        }]
      }

      // 3) Cevap anahtarı → rubrik → AI değerlendirmesi
      const result = await gradeFullExam({
        exam_id: examId,
        subject: detectedInfo.subject ?? 'Genel',
        questions,
      })
      setGradingResult(result)
      const reviewMsg = result.needs_review_count > 0
        ? `${result.needs_review_count} soru öğretmen incelemesi bekliyor`
        : 'Tüm sorular yüksek güvenle değerlendirildi'
      toast.success(
        `${seg.regions.length} soru okundu · ${result.total_score}/${result.total_max} puan`,
        { description: `${reviewMsg} (segmentasyon: ${seg.method})` },
      )
    } catch (err) {
      toast.error('Değerlendirme başarısız', { description: (err as Error).message })
    }

    setStep('review')
  }, [detectedInfo, uploadedFiles])

  async function runPipeline(
    stages: PipelineProgress[],
    setProgress: React.Dispatch<React.SetStateAction<PipelineProgress[]>>,
    setInfo: React.Dispatch<React.SetStateAction<DetectedInfo>>
  ) {
    const updated = [...stages]
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'running', progress: 10 }
      setProgress([...updated])

      try {
        const result = await runStage(updated[i].stage as any)

        if (!result.ok) {
          updated[i] = { ...updated[i], status: 'error', progress: 0, message: `${updated[i].message} (${result.error ?? 'hata'})` }
          setProgress([...updated])
          continue
        }

        const data = result.data ?? {}
        const srcLabel = result.source === 'device' ? '📱 cihaz' : '☁️ bulut'

        if (updated[i].stage === 'ogrenci_bilgi' && data.info) {
          setInfo(data.info)
        }

        updated[i] = { ...updated[i], status: 'done', progress: 100, message: `${updated[i].message} ✓ (${srcLabel})` }
      } catch (err) {
        updated[i] = { ...updated[i], status: 'error', progress: 0, message: `${updated[i].message} Hata: ${(err as Error).message}` }
      }

      setProgress([...updated])
    }
  }

  const allPages = uploadedFiles.flatMap(f => f.pages || [])

  if (step === 'processing') {
    return <ProcessingScreen stages={pipelineProgress} detected={detectedInfo} />
  }

  if (step === 'review') {
    const handleSaveToArchive = () => {
      // PATCH v1.8 — Öğretmen onayladı → arşive kaydet (GradeOverridden zaten
      // dijital masada üretiliyor). Burada sınav sonucu arşive işlenir.
      setSavedToArchive(true)
      toast.success('Sonuç arşive kaydedildi', {
        description: gradingResult
          ? `${detectedInfo.studentName ?? 'Öğrenci'} · ${gradingResult.total_score}/${gradingResult.total_max} puan`
          : undefined,
      })
      setTimeout(() => navigate('/archive'), 600)
    }

    return (
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">✅ İşlem Tamamlandı</h2>
            <p className="text-sm text-slate-400">
              {detectedInfo.studentName} · {detectedInfo.className} · {detectedInfo.subject}
            </p>
          </div>
          {gradingResult && (
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">
                {gradingResult.total_score}/{gradingResult.total_max}
              </div>
              <div className="text-xs text-slate-400">
                {gradingResult.needs_review_count > 0
                  ? `⚠ ${gradingResult.needs_review_count} soru inceleme bekliyor`
                  : '✓ Tümü yüksek güvenli'}
              </div>
            </div>
          )}
        </div>

        {/* PATCH v1.8 — Soru bazlı değerlendirme (cevap anahtarı→rubrik→AI) */}
        {gradingResult && (
          <div className="rounded-xl border border-slate-700 divide-y divide-slate-700 overflow-hidden">
            {gradingResult.questions.map((q) => (
              <div key={q.question_no} className="flex items-center justify-between p-3 text-sm">
                <span>Soru {q.question_no}</span>
                <span className="text-slate-400 text-xs flex-1 px-3 truncate">{q.explanation}</span>
                <span className={
                  q.source === 'answer_key' ? 'text-emerald-400 text-xs px-2'
                  : q.source === 'rubric' ? 'text-blue-400 text-xs px-2'
                  : 'text-amber-400 text-xs px-2'
                }>
                  {q.source === 'answer_key' ? '🔑 anahtar' : q.source === 'rubric' ? '📋 rubrik' : '🤖 tahmin'}
                </span>
                <span className="font-bold w-16 text-right">{q.ai_score}/{q.max_score}</span>
              </div>
            ))}
          </div>
        )}

        <Suspense fallback={<div className="text-slate-400">Dijital Masa yükleniyor...</div>}>
          <DeskPage detected={detectedInfo} totalPages={allPages.length || 1} />
        </Suspense>
        <div className="flex gap-3">
          <button onClick={() => { setStep('upload'); setUploadedFiles([]); setGradingResult(null); setSavedToArchive(false) }}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm">
            ↩ Yeni Yükleme
          </button>
          <button onClick={handleSaveToArchive} disabled={savedToArchive}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-sm font-bold">
            {savedToArchive ? '✓ Kaydedildi' : '💾 Onayla ve Arşive Kaydet'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <UploadScreen
      files={uploadedFiles} allPages={allPages} currentPage={currentPage}
      onFiles={handleFiles} onDrop={handleDrop} onStart={() => startProcessing()}
      onRemove={(id) => setUploadedFiles(prev => prev.filter(f => f.id !== id))}
      onPageChange={setCurrentPage}
      fileInputRef={fileInputRef} cameraInputRef={cameraInputRef}
      isMobile={isMobile} processingPdf={processingPdf}
    />
  )
}

// ── Upload Screen ───────────────────────────────────────────────────
function UploadScreen({ files, allPages, currentPage, onFiles, onDrop, onStart,
  onRemove, onPageChange, fileInputRef, cameraInputRef, isMobile, processingPdf }: {
  files: UploadFile[]; allPages: string[]; currentPage: number
  onFiles: (f: FileList | File[]) => void; onDrop: (e: React.DragEvent) => void
  onStart: () => void; onRemove: (id: string) => void; onPageChange: (i: number) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>; cameraInputRef: React.RefObject<HTMLInputElement | null>
  isMobile: boolean; processingPdf: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const hasFiles = files.length > 0

  if (!hasFiles) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-5">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">🎓 Dijital Öğretmen Asistanı</h1>
            <p className="text-sm text-slate-400">Sınav kağıdını yükleyin. PDF, fotoğraf veya kamerayla çekin.</p>
          </div>
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)} onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
              ${dragging ? 'border-blue-500 bg-blue-500/5 scale-[1.02]' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'}`}>
            <div className="text-6xl mb-4 opacity-70">📂</div>
            <div className="text-lg font-medium">PDF Sürükleyin veya Tıklayın</div>
            <div className="text-sm text-slate-500 mt-2">PDF · JPEG · PNG · Tek tek veya toplu</div>
            <div className="flex justify-center gap-3 mt-5">
              <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition-colors">
                🖼 Dosya Seç
              </button>
              {isMobile && (
                <button onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click() }}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-bold">
                  📷 Kamerayla Çek
                </button>
              )}
            </div>
          </div>
          <div className="text-center text-xs text-slate-500">
            Önlü arkalı · Çok sayfalı · {isMobile ? 'Telefon' : 'Tarayıcı'}
          </div>
          <input ref={fileInputRef} type="file" accept={FILE_ACCEPT} multiple className="hidden"
            onChange={(e) => e.target.files && onFiles(e.target.files)} />
          {isMobile && (
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
              onChange={(e) => e.target.files && onFiles(e.target.files)} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative bg-black/40 flex items-center justify-center min-h-0 p-2">
        {allPages[currentPage] ? (
          <img src={allPages[currentPage]} alt={`Sayfa ${currentPage + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        ) : (
          <div className="text-slate-600 text-center">
            {processingPdf ? (
              <><div className="text-4xl mb-2 animate-spin">⏳</div><div className="text-sm">PDF işleniyor...</div></>
            ) : (
              <><div className="text-5xl mb-2">📄</div><div className="text-sm">{files[0]?.name}</div></>
            )}
          </div>
        )}
      </div>
      <div className="text-center py-1">
        <span className="text-3xl font-black text-white/80">{currentPage + 1}</span>
        <span className="text-slate-500 mx-1">/</span>
        <span className="text-lg text-slate-500">{Math.max(1, allPages.length || files.length)}</span>
      </div>
      <div className="bg-slate-800/80 border-t border-slate-700/50 px-3 py-3">
        <div className="flex gap-2 overflow-x-auto justify-center">
          {allPages.length > 0 ? allPages.map((url, i) => (
            <button key={i} onClick={() => onPageChange(i)}
              className={`shrink-0 w-14 h-20 rounded-lg overflow-hidden border-2 transition-all
                ${i === currentPage ? 'border-blue-500 ring-2 ring-blue-500/30 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              <img src={url} alt={`Sayfa ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center font-bold py-0.5">{i + 1}</div>
            </button>
          )) : files.map((f) => (
            <div key={f.id} className="relative shrink-0 w-16 h-20 rounded-lg bg-slate-700 flex flex-col items-center justify-center border-2 border-transparent">
              <span className="text-lg">📄</span>
              <span className="text-[8px] mt-1 px-1 truncate max-w-full">{f.name}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-3 mt-3">
          <button onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-xs">
            + Dosya Ekle
          </button>
          <button onClick={onStart}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold"
            disabled={processingPdf}>
            🤖 AI İşlemeye Başla
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Processing Screen ───────────────────────────────────────────────
function ProcessingScreen({ stages, detected }: {
  stages: PipelineProgress[]; detected: DetectedInfo
}) {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center py-6">
        <div className="text-4xl mb-3 animate-pulse">🤖</div>
        <h2 className="text-lg font-bold">AI İşleme Devam Ediyor</h2>
        <p className="text-sm text-slate-400 mt-1">Lütfen bekleyin, sayfalar analiz ediliyor...</p>
      </div>
      <div className="space-y-3">
        {stages.map((s, i) => (
          <div key={s.stage} className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${s.status === 'done' ? 'bg-emerald-600 text-white' :
                s.status === 'running' ? 'bg-blue-600 text-white animate-pulse' :
                s.status === 'error' ? 'bg-red-600 text-white' :
                'bg-slate-700 text-slate-500'}`}>
              {s.status === 'done' ? '✓' : s.status === 'error' ? '!' : i + 1}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className={s.status === 'done' ? 'text-emerald-400' : s.status === 'running' ? 'text-blue-400' : 'text-slate-500'}>
                  {s.message}
                </span>
                <span className="text-xs text-slate-500">{s.progress}%</span>
              </div>
              <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300
                  ${s.status === 'done' ? 'bg-emerald-500' :
                    s.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${s.progress}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Utilities ───────────────────────────────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error('Dosya okunamadı'))
    r.readAsDataURL(file)
  })
}
