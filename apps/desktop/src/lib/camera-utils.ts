// @/lib/camera-utils.ts
// Camera capture with preview, auto-focus, torch, flip

/**
 * Start camera stream on a video element
 * @param videoEl - HTMLVideoElement
 * @param facingMode - 'environment' (arka kamera) | 'user' (ön kamera)
 * @returns stop function
 */
export async function startCamera(
  videoEl: HTMLVideoElement,
  facingMode: 'environment' | 'user' = 'environment'
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  })

  videoEl.srcObject = stream
  await videoEl.play()

  return () => {
    stream.getTracks().forEach(t => t.stop())
    videoEl.srcObject = null
  }
}

/**
 * Capture a frame from video as JPEG data URL
 */
export function captureFrame(videoEl: HTMLVideoElement, quality = 0.85): string {
  const canvas = document.createElement('canvas')
  canvas.width = videoEl.videoWidth
  canvas.height = videoEl.videoHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(videoEl, 0, 0)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  canvas.width = 0
  canvas.height = 0
  return dataUrl
}

/**
 * Check if camera is available on device
 */
export async function hasCamera(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.some(d => d.kind === 'videoinput')
  } catch {
    return false
  }
}

/**
 * Toggle torch on/off (if supported)
 */
export async function toggleTorch(videoEl: HTMLVideoElement): Promise<boolean> {
  try {
    const track = (videoEl.srcObject as MediaStream)?.getVideoTracks()?.[0]
    if (!track) return false
    const capabilities = track.getCapabilities() as any
    if (!capabilities?.torch) return false
    const current = track.getSettings() as any
    await track.applyConstraints({ advanced: [{ torch: !current.torch }] } as any)
    return !current.torch
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH v1.16 — AKILLI ARŞİV SIKIŞTIRMA (Adım 3)
// "Kaliteyi düşürmeden küçük boyut": metin okunabilirliğini koruyacak
// minimum çözünürlüğe indir + WebP (JPEG'den ~%30 küçük, aynı kalite).
// Teknoloji değişmedi — aynı canvas API, daha akıllı strateji.
// ═══════════════════════════════════════════════════════════════

export interface CompressResult {
  /** Tam sayfa, arşiv için optimize (WebP) */
  archived: string
  /** Küçük önizleme (liste/grid için) */
  thumbnail: string
  /** Orijinal ve sıkıştırılmış boyut (byte) */
  originalBytes: number
  archivedBytes: number
  ratio: number
}

function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.split(',')[1] ?? ''
  return Math.floor(b64.length * 0.75)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawScaled(img: HTMLImageElement, maxDim: number, mime: string, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // Yüksek kaliteli yeniden örnekleme (metin keskinliği için)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const out = canvas.toDataURL(mime, quality)
  canvas.width = 0
  canvas.height = 0
  return out
}

/**
 * Bir sınav görüntüsünü arşiv için akıllıca sıkıştır.
 *
 * Strateji:
 *  - Uzun kenar 2000px'e indirilir — el yazısı OCR/okuma için fazlasıyla yeterli,
 *    çoğu telefon fotoğrafı (4000px+) bunun 2 katı, yani yarı yarıya boyut.
 *  - WebP q=0.82: JPEG q=0.85'ten görsel olarak ayırt edilemez ama ~%30 küçük.
 *  - Tarayıcı WebP desteklemezse otomatik JPEG'e düşer.
 *  - Ayrıca 320px thumbnail üretir (arşiv listesi hızlı yüklensin).
 */
export async function compressForArchive(
  imageDataUrl: string,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<CompressResult> {
  const maxDim = opts.maxDim ?? 2000
  const quality = opts.quality ?? 0.82
  const img = await loadImage(imageDataUrl)

  // WebP destek tespiti
  const test = document.createElement('canvas').toDataURL('image/webp')
  const mime = test.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'

  const archived = drawScaled(img, maxDim, mime, quality)
  const thumbnail = drawScaled(img, 320, mime, 0.7)

  const originalBytes = dataUrlBytes(imageDataUrl)
  const archivedBytes = dataUrlBytes(archived)

  return {
    archived,
    thumbnail,
    originalBytes,
    archivedBytes,
    ratio: originalBytes > 0 ? archivedBytes / originalBytes : 1,
  }
}
