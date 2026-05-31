// apps/desktop/src/pages/ArchivePage.tsx
// Arşiv sayfası — Event Store'dan beslenir
// PATCH v1.16: arşivden çıkar + dijital masada tekrar düzenle

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArchiveBrowser } from '../components/exam/archive-browser'
import { loadDeskSnapshot } from '../lib/pipeline'
import { toast } from 'sonner'

const ArchivePage: React.FC = () => {
  const navigate = useNavigate()

  const handleEdit = async (examId: string) => {
    toast.loading('Arşivden açılıyor...', { id: 'reopen' })
    try {
      const snapshot = await loadDeskSnapshot(examId)
      if (!snapshot) {
        toast.error('Bu sınavın masa kaydı bulunamadı', { id: 'reopen' })
        return
      }
      // Masa durumunu sessionStorage üzerinden DeskPage'e taşı (Tauri masaüstü)
      try { sessionStorage.setItem('doa_reedit_snapshot', JSON.stringify(snapshot)) } catch {}
      toast.success('Dijital masada düzenlemeye hazır', { id: 'reopen' })
      navigate('/desk?reedit=' + encodeURIComponent(examId))
    } catch (err) {
      toast.error('Arşivden açılamadı: ' + (err as Error).message, { id: 'reopen' })
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-lg font-bold mb-4">🗄 Arşiv — Tüm Sınav Kayıtları</h2>
      <ArchiveBrowser schoolId={1} onEdit={handleEdit} />
    </div>
  )
}

export default ArchivePage
