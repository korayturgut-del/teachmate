/**
 * apps/mobile/src/screens/QuickReview.tsx
 *
 * v1.13 — Gerçek Pipeline Sonucuna Bağlandı
 * Mock AI kaldırıldı. Gerçek PipelineResult kullanılıyor.
 * ADR-007: 3-dokunuş akışı korunuyor.
 * ADR-011: QR köprüsü ile masaüstüne devir.
 * v1.11: OCR düzeltmeleri learning-engine'e iletiliyor.
 * Madde 6: Puan zinciri — cevap anahtarı → rubrik → AI → öğretmen.
 */

import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, TextInput, ScrollView, Alert, Modal,
} from 'react-native'
import type { PipelineResult } from '../lib/ocr-bridge'
import { formatCorrectionForLearning, createQrBridgeSession } from '../lib/ocr-bridge'

// ── Puan Durumu (Madde 6: determinizm önce, AI son çare) ────────────

export type ScoreStatus = 'correct' | 'partial' | 'wrong'

function scoreStatus(score: number, max: number): ScoreStatus {
  if (max <= 0) return 'wrong'
  const r = score / max
  if (r >= 0.99) return 'correct'
  if (r <= 0.01) return 'wrong'
  return 'partial'
}

// ── Tip Tanımları ────────────────────────────────────────────────────

interface GradedQuestion {
  no: number
  aiScore: number
  teacherScore?: number   // öğretmen düzeltmesi
  maxScore: number
  status: ScoreStatus
  explanation: string
  confidence: number      // OCR güven skoru — ısı haritası
}

interface ReviewState {
  studentName: string
  studentNo: string
  className: string
  subject: string
  questions: GradedQuestion[]
  /** Grading route — kullanıcıya gösterilen şeffaflık (ADR-010 rozeti) */
  gradingRoute: 'local_resolve' | 'cloud_escalate' | 'offline_queue'
  /** OCR motoru */
  ocrEngine: string
  /** Genel OCR güveni */
  ocrConfidence: number
}

interface QuickReviewProps {
  photoUri: string
  pipeline: PipelineResult
  onSave: (state: ReviewState) => void
  onRetake: () => void
}

// ── Pipeline → ReviewState dönüşümü ─────────────────────────────────

function pipelineToReviewState(pipeline: PipelineResult): ReviewState {
  // v1.13: Gerçek OCR metninden soru yapısı çıkar.
  // Tam implement: question-segmentation paketi ile bbox bazlı ayrıştırma.
  // Şimdilik: OCR blokları soru başına gruplanıyor.
  const blocks = pipeline.ocr.blocks
  const questions: GradedQuestion[] = blocks.map((block, i) => ({
    no: i + 1,
    aiScore: 0,   // Cevap anahtarı bağlanınca gerçek puan
    maxScore: 10,
    status: 'partial' as ScoreStatus,
    explanation: block.text.slice(0, 60),
    confidence: block.confidence,
  }))

  // En az 1 soru göster
  const qs = questions.length > 0 ? questions : [{
    no: 1, aiScore: 0, maxScore: 10, status: 'partial' as ScoreStatus,
    explanation: pipeline.ocr.rawText.slice(0, 80),
    confidence: pipeline.ocr.confidence,
  }]

  return {
    studentName: '',    // QR/OCR'dan otomatik dolduracak — şimdi boş
    studentNo: '',
    className: '',
    subject: '',
    questions: qs,
    gradingRoute: pipeline.decision.route,
    ocrEngine: pipeline.ocr.engine,
    ocrConfidence: pipeline.ocr.confidence,
  }
}

// ── Bileşen ──────────────────────────────────────────────────────────

const QuickReview: React.FC<QuickReviewProps> = ({
  photoUri, pipeline, onSave, onRetake,
}) => {
  const [state, setState] = useState<ReviewState>(() =>
    pipelineToReviewState(pipeline))
  const [editingQ, setEditingQ] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrChunks, setQrChunks] = useState<string[]>([])
  const [qrIdx, setQrIdx] = useState(0)

  const totalScore = state.questions.reduce(
    (s, q) => s + (q.teacherScore ?? q.aiScore), 0)
  const maxTotal = state.questions.reduce((s, q) => s + q.maxScore, 0)

  // Öğretmen puan düzeltme
  const handleOverride = useCallback((no: number, newScore: number) => {
    setState(prev => {
      const qs = prev.questions.map(q => {
        if (q.no !== no) return q
        const clamped = Math.max(0, Math.min(newScore, q.maxScore))
        return {
          ...q,
          teacherScore: clamped,
          status: scoreStatus(clamped, q.maxScore),
        }
      })
      return { ...prev, questions: qs }
    })

    // v1.11 — OCR düzeltmesini learning-engine formatına hazırla
    const q = state.questions.find(q => q.no === no)
    if (q) {
      const corrInput = formatCorrectionForLearning({
        ocrText: q.explanation,
        correctedText: String(newScore),
        engine: state.ocrEngine as 'mlkit' | 'apple_vision',
        ocrConfidence: q.confidence,
        contentType: 'handwriting',
        teacherId: 'current-teacher',    // gerçekte context'ten gelir
        consentToTrain: true,
      })
      // Gerçekte: learningEngine.recordCorrection(corrInput)
      console.log('[v1.11 learning]', corrInput)
    }
  }, [state.questions, state.ocrEngine])

  // ADR-011: QR köprüsü — masaüstüne devir
  const handleQrBridge = useCallback(async () => {
    try {
      const events = state.questions.map(q => ({
        eventType: 'MobileCaptureCompleted',
        aggregate: 'mobile_capture',
        payload: {
          questionNo: q.no,
          aiScore: q.aiScore,
          teacherScore: q.teacherScore,
          confidence: q.confidence,
        },
      }))

      const sessionKey = Math.random().toString(36).slice(2, 18)
      const session = await createQrBridgeSession(
        events,
        sessionKey,
        // Stub encrypt — gerçekte Tauri IPC veya native crypto
        async (data, _key) => ({
          ciphertext: btoa(encodeURIComponent(data).slice(0, 500)),
          nonce: Math.random().toString(36).slice(2),
        }),
        async (data) => data.slice(0, 16),
      )

      setQrChunks(session.qrChunks)
      setQrIdx(0)
      setShowQrModal(true)

      Alert.alert(
        'QR Köprüsü',
        `Masaüstünde kamera ile ${session.totalChunks} QR karesini sırayla okutun.\n` +
        `Oturum anahtarı: ${sessionKey.slice(0, 8)}...`,
      )
    } catch (e) {
      Alert.alert('Hata', 'QR köprüsü oluşturulamadı')
    }
  }, [state])

  // Güven rengi (ısı haritası)
  const confidenceColor = (c: number) =>
    c >= 0.85 ? '#10b981' : c >= 0.70 ? '#f59e0b' : '#ef4444'

  // Route rozeti (ADR-010 şeffaflık)
  const routeLabel: Record<ReviewState['gradingRoute'], string> = {
    local_resolve: '🖥 Yerel',
    cloud_escalate: '☁️ Cloud',
    offline_queue: '📵 Kuyrukta',
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Fotoğraf önizleme */}
      <Image source={{ uri: photoUri }} style={styles.previewImg} resizeMode="contain" />

      {/* OCR + Route bilgisi (ADR-010 rozeti) */}
      <View style={styles.metaRow}>
        <View style={styles.metaBadge}>
          <Text style={styles.metaBadgeText}>
            {state.ocrEngine === 'apple_vision' ? '🍎 Vision' : '📊 ML Kit'}
          </Text>
        </View>
        <View style={styles.metaBadge}>
          <Text style={styles.metaBadgeText}>
            {routeLabel[state.gradingRoute]}
          </Text>
        </View>
        <View style={[styles.metaBadge, { borderColor: confidenceColor(state.ocrConfidence) }]}>
          <Text style={[styles.metaBadgeText, { color: confidenceColor(state.ocrConfidence) }]}>
            {(state.ocrConfidence * 100).toFixed(0)}% güven
          </Text>
        </View>
        {pipeline.qrPayload && (
          <View style={[styles.metaBadge, { borderColor: '#34d399' }]}>
            <Text style={[styles.metaBadgeText, { color: '#34d399' }]}>
              🔖 {pipeline.qrPayload}
            </Text>
          </View>
        )}
      </View>

      {/* Puan banner */}
      <View style={styles.scoreBanner}>
        <Text style={styles.scoreBig}>{totalScore}</Text>
        <Text style={styles.scoreMax}>/ {maxTotal}</Text>
        <Text style={styles.scoreLabel}>puan</Text>
      </View>

      {/* Soru detayları — ısı haritası overlay */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Soru Detayları</Text>
        {state.questions.map(q => (
          <View key={q.no} style={[
            styles.questionRow,
            { borderLeftColor: confidenceColor(q.confidence), borderLeftWidth: 3 },
          ]}>
            <View style={styles.qLeft}>
              <Text style={styles.qNum}>S{q.no}</Text>
              <View style={[
                styles.statusDot,
                q.status === 'correct' ? styles.dotCorrect :
                q.status === 'partial' ? styles.dotPartial : styles.dotWrong,
              ]} />
              {/* Güven göstergesi — düşük = kırmızı (ısı haritası) */}
              <Text style={[styles.confTxt, { color: confidenceColor(q.confidence) }]}>
                {(q.confidence * 100).toFixed(0)}%
              </Text>
            </View>

            {editingQ === q.no ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={editVal}
                  onChangeText={setEditVal}
                  keyboardType="numeric"
                  autoFocus
                />
                <TouchableOpacity onPress={() => {
                  handleOverride(q.no, parseInt(editVal) || 0)
                  setEditingQ(null)
                }} style={styles.editSave}>
                  <Text style={styles.editSaveText}>✓</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => {
                setEditingQ(q.no)
                setEditVal(String(q.teacherScore ?? q.aiScore))
              }} style={styles.scoreCell}>
                <Text style={styles.scoreVal}>{q.teacherScore ?? q.aiScore}</Text>
                <Text style={styles.scoreMaxSmall}>/{q.maxScore}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.explanation} numberOfLines={1}>{q.explanation}</Text>
          </View>
        ))}
      </View>

      {/* Öğretmen incelemesi gerekliyse uyarı (Kural 12) */}
      {pipeline.decision.requiresTeacherReview && (
        <View style={styles.reviewWarning}>
          <Text style={styles.reviewWarningText}>
            ⚠️ Düşük OCR güveni — öğretmen incelemesi gerekli (Kural 12)
          </Text>
        </View>
      )}

      {/* Aksiyonlar — ADR-007 3. dokunuş */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
          <Text style={styles.retakeBtnText}>↩ Tekrar Çek</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={() => {
          Alert.alert('Kaydedildi', `${totalScore}/${maxTotal} puan kaydedildi.`)
          onSave(state)
        }}>
          <Text style={styles.saveBtnText}>💾 Onayla ve Kaydet</Text>
        </TouchableOpacity>
      </View>

      {/* ADR-011: Masaüstüne Gönder butonu */}
      <TouchableOpacity style={styles.qrBridgeBtn} onPress={handleQrBridge}>
        <Text style={styles.qrBridgeBtnText}>📱→🖥 QR Köprüsü ile Masaüstüne Gönder</Text>
      </TouchableOpacity>

      {/* QR Köprüsü Modal (ADR-011) */}
      <Modal visible={showQrModal} animationType="slide" transparent>
        <View style={styles.qrModal}>
          <View style={styles.qrModalContent}>
            <Text style={styles.qrTitle}>
              QR Köprüsü — {qrIdx + 1}/{qrChunks.length}
            </Text>
            <View style={styles.qrPlaceholder}>
              {/* Gerçekte: <QRCode value={qrChunks[qrIdx]} size={240} /> */}
              <Text style={styles.qrText}>{qrChunks[qrIdx]?.slice(0, 60)}...</Text>
              <Text style={styles.qrNote}>
                Gerçek QR: react-native-qrcode-svg paketi eklenecek
              </Text>
            </View>
            <View style={styles.qrNav}>
              {qrIdx > 0 && (
                <TouchableOpacity onPress={() => setQrIdx(i => i - 1)} style={styles.qrNavBtn}>
                  <Text style={styles.qrNavTxt}>← Önceki</Text>
                </TouchableOpacity>
              )}
              {qrIdx < qrChunks.length - 1 ? (
                <TouchableOpacity onPress={() => setQrIdx(i => i + 1)} style={styles.qrNavBtn}>
                  <Text style={styles.qrNavTxt}>Sonraki →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setShowQrModal(false)}
                  style={[styles.qrNavBtn, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.qrNavTxt}>✓ Tamamlandı</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, gap: 14 },
  previewImg: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#1e293b' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  metaBadgeText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  scoreBanner: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    backgroundColor: '#1e293b', borderRadius: 16, padding: 20,
    justifyContent: 'center',
  },
  scoreBig: { color: '#10b981', fontSize: 48, fontWeight: '900' },
  scoreMax: { color: '#64748b', fontSize: 22, fontWeight: '700' },
  scoreLabel: { color: '#94a3b8', fontSize: 14, marginLeft: 4 },
  section: { gap: 8 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  questionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e293b', borderRadius: 12, padding: 12,
  },
  qLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qNum: { color: '#94a3b8', fontSize: 12, fontWeight: '700', width: 24 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotCorrect: { backgroundColor: '#10b981' },
  dotPartial: { backgroundColor: '#f59e0b' },
  dotWrong: { backgroundColor: '#ef4444' },
  confTxt: { fontSize: 10, fontWeight: '700', width: 32 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editInput: {
    backgroundColor: '#0f172a', color: '#fff', fontSize: 16, fontWeight: '700',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, width: 48,
    textAlign: 'center', borderWidth: 1, borderColor: '#3b82f6',
  },
  editSave: {
    backgroundColor: '#3b82f6', width: 28, height: 28,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  editSaveText: { color: '#fff', fontWeight: '700' },
  scoreCell: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 8 },
  scoreVal: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scoreMaxSmall: { color: '#64748b', fontSize: 11 },
  explanation: { color: '#64748b', fontSize: 11, flex: 1, textAlign: 'right' },
  reviewWarning: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#f59e0b',
  },
  reviewWarningText: { color: '#fbbf24', fontSize: 12, textAlign: 'center' },
  actionBar: { flexDirection: 'row', gap: 12 },
  retakeBtn: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  retakeBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2, backgroundColor: '#3b82f6', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  qrBridgeBtn: {
    backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)',
  },
  qrBridgeBtnText: { color: '#818cf8', fontSize: 13, fontWeight: '600' },
  qrModal: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  qrModalContent: {
    backgroundColor: '#1e293b', borderRadius: 20, padding: 24,
    width: '100%', gap: 16, alignItems: 'center',
  },
  qrTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  qrPlaceholder: {
    width: 240, height: 240, backgroundColor: '#fff', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', padding: 12,
  },
  qrText: { color: '#0f172a', fontSize: 9, textAlign: 'center' },
  qrNote: { color: '#64748b', fontSize: 10, marginTop: 8, textAlign: 'center' },
  qrNav: { flexDirection: 'row', gap: 12 },
  qrNavBtn: {
    backgroundColor: '#3b82f6', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  qrNavTxt: { color: '#fff', fontWeight: '700' },
})

export default QuickReview
