// apps/desktop/src/pages/EditorPage.tsx
// ADR-004: Yalnızca /editor route'unda render edilir — Fabric.js
// React.lazy() ile yüklenir — bundle'a yalnızca bu route açılınca eklenir.

import React, { Suspense, useState } from 'react'

// Lazy-load Fabric.js editör motoru → ayrı chunk
const EditorCanvas = React.lazy(() =>
  import('@doa/editor-engine').then(m => ({ default: m.EditorCanvas }))
)

const EditorPage: React.FC = () => {
  const [width, setWidth] = useState(794)  // A4 @ 96dpi
  const [height, setHeight] = useState(1123)

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">🦋 Kelebek Sınav Editörü</h2>
          <p className="text-sm text-slate-400">
            Sınav şablonu tasarlayın · Soru ekleyin · QR kod oluşturun
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setWidth(794); setHeight(1123) }}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
          >
            A4 Dikey
          </button>
          <button
            onClick={() => { setWidth(1123); setHeight(794) }}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
          >
            A4 Yatay
          </button>
          <button className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 font-bold">
            🖨 Yazdır
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex justify-center p-4">
        <Suspense fallback={
          <div className="flex items-center justify-center bg-slate-100 text-slate-400" style={{ width, height }}>
            <div className="text-center">
              <div className="text-4xl mb-2 animate-pulse">🦋</div>
              <div className="text-sm">Editör yükleniyor...</div>
            </div>
          </div>
        }>
          <EditorCanvas
            width={width}
            height={height}
            onReady={(_canvas: unknown) => console.log('[EditorPage] Fabric.js canvas ready')}
          />
        </Suspense>
      </div>
    </div>
  )
}

export default EditorPage
