// @/lib/pdf-utils.ts
// PDF.js page extraction — renders PDF pages to image data URLs

// Dynamic import: pdfjs-dist from npm or CDN fallback
let pdfjsInstance: any = null

const WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'

async function ensurePdfJs() {
  if (pdfjsInstance) return pdfjsInstance

  // Try npm package first
  try {
    const mod = await import('pdfjs-dist')
    mod.GlobalWorkerOptions.workerSrc = WORKER_SRC
    pdfjsInstance = mod
    return pdfjsInstance
  } catch {
    // CDN fallback
    try {
      // @ts-ignore — runtime CDN fallback; TS bu URL'i modül olarak çözemez
      const mod = await import(/* @vite-ignore */ 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs')
      mod.GlobalWorkerOptions.workerSrc = WORKER_SRC
      pdfjsInstance = mod
      return pdfjsInstance
    } catch (e) {
      throw new Error('PDF.js yüklenemedi: ' + (e as Error).message)
    }
  }
}

export interface ExtractedPage {
  dataUrl: string
  width: number
  height: number
  pageNumber: number
}

export interface PdfResult {
  pages: ExtractedPage[]
  pageCount: number
  fingerprint: string
  errors: { page: number; error: string }[]
}

/**
 * Extract all pages from a PDF file as JPEG data URLs
 * Each page rendered at 150% scale (good OCR quality)
 */
export async function extractPdfPages(file: File): Promise<PdfResult> {
  const pdfjs = await ensurePdfJs()
  const arrayBuffer = await file.arrayBuffer()

  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const pageCount = doc.numPages
  const fingerprint = doc.fingerprints?.[0] || ''
  const pages: ExtractedPage[] = []
  const errors: { page: number; error: string }[] = []

  const scale = 1.5 // 150% — good quality
  const maxDim = 2048 // max width or height

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i)
      let viewport = page.getViewport({ scale })

      // Clamp to max dimension
      let finalScale = scale
      if (viewport.width > maxDim || viewport.height > maxDim) {
        const ratio = Math.min(maxDim / viewport.width, maxDim / viewport.height)
        finalScale = scale * ratio
        viewport = page.getViewport({ scale: finalScale })
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: ctx, viewport }).promise
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

      pages.push({
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        pageNumber: i,
      })

      canvas.width = 0
      canvas.height = 0
      page.cleanup()
    } catch (err) {
      errors.push({ page: i, error: (err as Error).message })
    }
  }

  doc.destroy()
  return { pages, pageCount, fingerprint, errors }
}

/**
 * Validate file is a PDF
 */
export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}
