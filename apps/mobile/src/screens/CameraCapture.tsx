/**
 * apps/mobile/src/screens/CameraCapture.tsx
 *
 * v1.13 — Gerçek OCR Pipeline Bağlantısı
 * react-native-vision-camera-ocr-plus → decision-engine zinciri.
 * ADR-007: 3-dokunuş akışı korunuyor.
 * Madde 5: Türkçe karakter desteği zorunlu (lang="tr").
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { Camera, useCameraDevice } from 'react-native-vision-camera'
import {
  runMobilePipeline,
  type PipelineResult,
  type OcrDecision,
} from '../lib/ocr-bridge'

interface CameraCaptureProps {
  /** Cevap anahtarı ID'si (masaüstünden sync — ADR-011) */
  answerKeyId?: string
  examId: string
  teacherId: string
  isOnline?: boolean
  /** Pipeline tamamlandığında — QuickReview'a geçiş */
  onPipelineComplete: (photoUri: string, pipeline: PipelineResult) => void
  onCancel: () => void
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  answerKeyId,
  examId,
  teacherId,
  isOnline = true,
  onPipelineComplete,
  onCancel,
}) => {
  const device = useCameraDevice('back')
  const cameraRef = useRef<Camera>(null)
  const [capturing, setCapturing] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [pipelineStep, setPipelineStep] = useState<
    'idle' | 'capturing' | 'ocr' | 'deciding'
  >('idle')

  useEffect(() => {
    Camera.requestCameraPermission().then(status => {
      setHasPermission(status === 'granted')
    })
  }, [])

  // Dokunuş 1: Çek → OCR → Karar → QuickReview (tek dokunuş, 3 adım arka planda)
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return
    setCapturing(true)

    try {
      // 1. Fotoğraf çek
      setPipelineStep('capturing')
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'balanced',
        flash: 'auto',
      })

      // 2. OCR çalıştır (ML Kit / Apple Vision)
      setPipelineStep('ocr')

      // 3. Decision Engine → route belirle
      setPipelineStep('deciding')
      const pipeline = await runMobilePipeline(photo.path, {
        questionType: 'open',   // Answer Key bağlanınca otomatik 'closed'
        teacherId,
        isOnline,
        examId,
        questionNo: 1,
      })

      // Pipeline tamamlandı → QuickReview
      onPipelineComplete(photo.path, pipeline)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      Alert.alert('Hata', 'Pipeline başarısız: ' + msg)
    } finally {
      setCapturing(false)
      setPipelineStep('idle')
    }
  }, [capturing, teacherId, isOnline, examId, onPipelineComplete])

  // Pipeline adım etiketi
  const stepLabel: Record<typeof pipelineStep, string> = {
    idle: '',
    capturing: 'Fotoğraf çekiliyor...',
    ocr: 'Yazı okunuyor (ML Kit / Apple Vision)...',
    deciding: 'Karar motoru çalışıyor...',
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.title}>Kamera İzni Gerekli</Text>
        <Text style={styles.subtitle}>Kağıt okumak için kamera izni verin.</Text>
        <TouchableOpacity style={styles.ghostBtn}
          onPress={() => Camera.requestCameraPermission()}>
          <Text style={styles.ghostBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.subtitle}>Kamera başlatılıyor...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        device={device}
        isActive={!capturing}
        photo={true}
        style={StyleSheet.absoluteFill}
      />

      {/* Kılavuz Çerçevesi */}
      <View style={styles.guideOverlay}>
        <View style={styles.guideRect}>
          <Text style={styles.guideText}>Kağıdı bu alana yerleştirin</Text>
        </View>
      </View>

      {/* Üst Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onCancel} style={styles.topBtn}>
          <Text style={styles.topBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Kağıdı Çerçevele</Text>
        {/* OCR modu rozeti */}
        <View style={styles.ocrBadge}>
          <Text style={styles.ocrBadgeText}>
            {'ios' === 'ios' ? '🍎 Vision' : '📊 ML Kit'}
          </Text>
        </View>
      </View>

      {/* Pipeline yükleniyorsa overlay */}
      {capturing && (
        <View style={styles.pipelineOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.pipelineText}>{stepLabel[pipelineStep]}</Text>
          <Text style={styles.pipelineSubtext}>Türkçe el yazısı destekleniyor</Text>
        </View>
      )}

      {/* Alt Bar — Dokunuş 1: Deklanşör */}
      <View style={styles.bottomBar}>
        {answerKeyId && (
          <Text style={styles.answerKeyBadge}>🔑 Cevap anahtarı yüklü</Text>
        )}
        {!isOnline && (
          <Text style={styles.offlineBadge}>📵 Çevrimdışı — kuyrukta bekleyecek</Text>
        )}
        <TouchableOpacity
          style={[styles.shutterBtn, capturing && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={capturing}
          activeOpacity={0.7}
        >
          {capturing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: '#0f172a',
  },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  ghostBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
  },
  ghostBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 15 },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  guideRect: {
    width: '85%', aspectRatio: 3 / 4,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  guideText: {
    color: 'rgba(255,255,255,0.4)', fontSize: 12,
    marginTop: 'auto', marginBottom: 12,
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  topBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBtnText: { color: '#fff', fontSize: 22 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ocrBadge: {
    backgroundColor: 'rgba(59,130,246,0.3)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  ocrBadgeText: { color: '#93c5fd', fontSize: 11, fontWeight: '700' },
  pipelineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  pipelineText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pipelineSubtext: { color: '#94a3b8', fontSize: 12 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    justifyContent: 'center', alignItems: 'center',
    paddingBottom: 48, paddingTop: 12, gap: 8,
  },
  answerKeyBadge: { color: '#34d399', fontSize: 12, fontWeight: '600' },
  offlineBadge: { color: '#fbbf24', fontSize: 12 },
  shutterBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  shutterDisabled: { opacity: 0.6 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
})

export default CameraCapture
