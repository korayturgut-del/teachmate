// @/packages/editor-engine/src/index.ts
// Kelebek Editor Engine — Fabric.js React Wrapper
// Phase 2: Fabric v6'dan Canvas doğrudan import edilir.
// ADR-004: Yalnızca /editor route'unda render edilir.

import React, { useEffect, useRef, useState } from 'react'
import { Canvas as FabricCanvas } from 'fabric'

export interface EditorEngineProps {
  /** Canvas genişliği (px) */
  width?: number
  /** Canvas yüksekliği (px) */
  height?: number
  /** Callback — canvas hazır olduğunda */
  onReady?: (canvas: FabricCanvas) => void
  /** Callback — değişiklik olduğunda */
  onChange?: () => void
}

/**
 * Fabric.js Canvas React Wrapper.
 * Phase 2: Boş iskelet. Phase 3-4: Kaynak A portu tamamlanır.
 *
 * NOT: Bu bileşen yalnızca /editor route'unda kullanılır.
 * Konva.js ile asla aynı anda render edilmez (ADR-004).
 * Fabric v6: doğrudan Canvas import, özel tipler pakete gömülü.
 */
export const EditorCanvas: React.FC<EditorEngineProps> = ({
  width = 800,
  height = 600,
  onReady,
  onChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const fabricRef = useRef<FabricCanvas | null>(null)

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    try {
      const fabricCanvas = new FabricCanvas(canvasRef.current, {
        width,
        height,
        backgroundColor: '#ffffff',
        selection: true,
        preserveObjectStacking: true,
      })
      fabricRef.current = fabricCanvas
      setLoaded(true)
      onReady?.(fabricCanvas)
    } catch (err) {
      console.error('[EditorEngine] Fabric.js Canvas oluşturulamadı:', err)
    }

    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [width, height])

  return (
    <div className="editor-engine-wrapper relative" style={{ width, height }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
          🎨 Editor yükleniyor...
        </div>
      )}
      <canvas ref={canvasRef} />
    </div>
  )
}

/**
 * Soru tipi tanımları (Kaynak A'dan port)
 */
export enum QuestionType {
  MULTIPLE_CHOICE = 'mc',
  OPEN_ENDED = 'open',
  FILL_IN_BLANK = 'fill',
  SECTION = 'sec',
}

export interface EditorQuestion {
  id: string
  type: QuestionType
  text: string
  points: number
  options?: string[]
  correctOption?: number
  images?: string[]
  section?: string
}

export default EditorCanvas
