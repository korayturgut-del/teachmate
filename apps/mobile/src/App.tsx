/**
 * apps/mobile/src/App.tsx — v1.13
 * Ekranlar: Camera → QuickReview → Archive
 * Pipeline verisi ekranlar arasında state ile taşınır.
 */
import React, { useState } from 'react'
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native'
import CameraCapture from './screens/CameraCapture'
import QuickReview from './screens/QuickReview'
import Archive from './screens/Archive'
import type { PipelineResult } from './lib/ocr-bridge'
import type { ReviewState } from './screens/QuickReview'

type Screen = 'camera' | 'review' | 'archive'

export default function App() {
  const [screen, setScreen] = useState<Screen>('camera')
  const [photoUri, setPhotoUri] = useState<string>('')
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null)
  const [saved, setSaved] = useState<ReviewState[]>([])

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {screen === 'camera' && (
        <CameraCapture
          examId="exam-current"
          teacherId="teacher-001"
          isOnline={true}
          onPipelineComplete={(uri, pl) => {
            setPhotoUri(uri)
            setPipeline(pl)
            setScreen('review')
          }}
          onCancel={() => setScreen('archive')}
        />
      )}

      {screen === 'review' && pipeline && (
        <QuickReview
          photoUri={photoUri}
          pipeline={pipeline}
          onSave={(state) => {
            setSaved(prev => [...prev, state])
            setScreen('camera')
          }}
          onRetake={() => setScreen('camera')}
        />
      )}

      {screen === 'archive' && (
        <Archive onBack={() => setScreen('camera')} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
})
