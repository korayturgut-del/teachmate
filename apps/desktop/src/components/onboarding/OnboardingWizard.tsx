/**
 * OnboardingWizard.tsx — v1.14 Teacher Trust
 *
 * İlk çalıştırmada öğretmene gösterilen kurulum sihirbazı.
 * localStorage'da 'doa-onboarded' flag ile bir kez gösterilir.
 * 3 adım: Hoş Geldiniz → Profil → Hazır
 *
 * Constitution Madde 2 (NO ESCAPE): Her adım kaydedilebilir,
 * "Atla" sadece son adımda mevcut.
 */
import React, { useState } from 'react'

export interface TeacherProfile {
  name: string
  school: string
  subject: string
  /** Toplu onay eşiği — öğretmen tercihine göre (Kural 12) */
  bulkApproveThreshold: number
}

interface OnboardingWizardProps {
  onComplete: (profile: TeacherProfile) => void
}

const STEPS = ['Hoş Geldiniz', 'Profil', 'Hazır'] as const
type Step = 0 | 1 | 2

const DEFAULT_PROFILE: TeacherProfile = {
  name: '',
  school: '',
  subject: 'Matematik',
  bulkApproveThreshold: 0.85,
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>(0)
  const [profile, setProfile] = useState<TeacherProfile>(DEFAULT_PROFILE)
  const [err, setErr] = useState('')

  const handleNext = () => {
    if (step === 1) {
      if (!profile.name.trim()) { setErr('Ad Soyad gerekli'); return }
      if (!profile.school.trim()) { setErr('Okul adı gerekli'); return }
    }
    setErr('')
    if (step < 2) setStep(s => (s + 1) as Step)
    else handleComplete()
  }

  const handleComplete = () => {
    localStorage.setItem('doa-onboarded', '1')
    localStorage.setItem('doa-teacher-profile', JSON.stringify(profile))
    onComplete(profile)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6">
        {/* Adım göstergesi */}
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold transition-colors
                ${i === step ? 'text-blue-400' : i < step ? 'text-emerald-400' : 'text-slate-500'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border
                  ${i === step ? 'border-blue-400 text-blue-400'
                  : i < step ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400'
                  : 'border-slate-600 text-slate-600'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="hidden sm:block">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${i < step ? 'bg-emerald-400/40' : 'bg-slate-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Adım 0: Hoş Geldiniz */}
        {step === 0 && (
          <div className="space-y-4 text-center">
            <div className="text-6xl">🎓</div>
            <h1 className="text-2xl font-black text-white">
              Dijital Öğretmen Asistanı
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Türk öğretmenleri için yapay zeka destekli sınav okuma sistemi.
              El yazısı dahil tüm sınav kağıtlarınızı saniyeler içinde değerlendirin.
            </p>
            <div className="grid grid-cols-2 gap-3 text-left mt-4">
              {[
                { icon: '🔒', text: 'Veriler cihazda — buluta gitmiyor' },
                { icon: '✍️', text: 'Türkçe el yazısı desteği' },
                { icon: '🔑', text: 'Cevap anahtarı önce, AI son çare' },
                { icon: '📵', text: 'İnternetsiz çalışıyor' },
              ].map(f => (
                <div key={f.icon} className="flex items-start gap-2 bg-slate-700/50 rounded-lg p-2.5">
                  <span className="text-base">{f.icon}</span>
                  <span className="text-slate-300 text-xs">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adım 1: Profil */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Profil Bilgileriniz</h2>
              <p className="text-slate-400 text-sm">
                Bu bilgiler cihazınızda saklanır, buluta gönderilmez.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Ad Soyad *
                </label>
                <input
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5
                    text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Ahmet Yılmaz"
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Okul Adı *
                </label>
                <input
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5
                    text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Atatürk Anadolu Lisesi"
                  value={profile.school}
                  onChange={e => setProfile(p => ({ ...p, school: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Branş
                </label>
                <select
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5
                    text-white focus:outline-none focus:border-blue-500 text-sm"
                  value={profile.subject}
                  onChange={e => setProfile(p => ({ ...p, subject: e.target.value }))}
                >
                  {['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe',
                    'Tarih', 'Coğrafya', 'İngilizce', 'Diğer'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Otomatik Onay Eşiği — %{Math.round(profile.bulkApproveThreshold * 100)}
                </label>
                <input
                  type="range" min={0.7} max={0.99} step={0.05}
                  className="w-full accent-blue-500"
                  value={profile.bulkApproveThreshold}
                  onChange={e => setProfile(p => ({ ...p, bulkApproveThreshold: parseFloat(e.target.value) }))}
                />
                <p className="text-slate-500 text-xs mt-1">
                  Bu güvenin üstündeki sorular toplu onaylanabilir (v1.10)
                </p>
              </div>
            </div>

            {err && <p className="text-red-400 text-xs">{err}</p>}
          </div>
        )}

        {/* Adım 2: Hazır */}
        {step === 2 && (
          <div className="space-y-4 text-center">
            <div className="text-6xl">🚀</div>
            <h2 className="text-xl font-bold text-white">Hazırsınız!</h2>
            <div className="bg-slate-700/50 rounded-xl p-4 text-left space-y-2">
              <p className="text-slate-300 text-sm">
                <span className="text-slate-500">Öğretmen:</span> {profile.name}
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-slate-500">Okul:</span> {profile.school}
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-slate-500">Branş:</span> {profile.subject}
              </p>
            </div>
            <p className="text-slate-400 text-sm">
              Sınav yükleyerek veya editörde şablon oluşturarak başlayabilirsiniz.
            </p>
          </div>
        )}

        {/* Navigasyon */}
        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300
                rounded-lg text-sm font-medium transition-colors"
            >
              ← Geri
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white
              rounded-lg text-sm font-bold transition-colors"
          >
            {step === 2 ? '🚀 Başla' : 'İleri →'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Onboarding tamamlandı mı? */
export function isOnboarded(): boolean {
  return localStorage.getItem('doa-onboarded') === '1'
}

/** Kaydedilmiş öğretmen profilini yükle */
export function loadTeacherProfile(): TeacherProfile | null {
  try {
    const raw = localStorage.getItem('doa-teacher-profile')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
