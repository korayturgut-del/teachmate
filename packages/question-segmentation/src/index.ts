/**
 * @doa/question-segmentation
 *
 * Soru Segmentasyonu — ChatGPT mimarisinde "eksik" olan katman.
 *
 * Sorun: Tüm sayfayı OCR etmek hem yavaş hem yanlış. Bir sayfada 4 soru varsa,
 * 100 sayfa = 400 soru alanı; her alanı AYRI işlemek daha doğru ve ekonomik.
 *
 * Akış (Desktop KADEME 4):
 *   Sayfa → [Soru 1 kutusu, Soru 2 kutusu, ...] → her kutu ayrı OCR
 *
 * Kutular iki yoldan gelir:
 *   1. Şablon tabanlı (template-engine): sınav tasarımından sabit bbox'lar — EN GÜVENİLİR
 *   2. Otomatik tespit: yatay boşluk analizi (şablon yoksa fallback)
 */

// ── Tipler ─────────────────────────────────────────────────────

/** Normalize bbox: [ymin, xmin, ymax, xmax], her değer 0-1000 arası. */
export type BBox = [number, number, number, number]

export interface QuestionRegion {
  questionNo: number
  bbox: BBox
  /** Şablondan mı geldi yoksa otomatik mi tespit edildi? */
  source: 'template' | 'auto'
  maxScore?: number
}

export interface SegmentationResult {
  regions: QuestionRegion[]
  pageWidth: number
  pageHeight: number
  method: 'template' | 'auto'
}

/** Otomatik tespit için satır kutusu (OCR/layout'tan gelir). */
export interface TextLineBox {
  bbox: BBox
  text?: string
}

// ── Şablon Tabanlı Segmentasyon (EN GÜVENİLİR) ────────────────

/**
 * Şablondaki soru bbox'larını kullan (template-engine'den).
 * QR ile doğrulanmış sınav versiyonunun layout'u bilindiğinde tercih edilir.
 */
export function segmentFromTemplate(
  questions: Array<{ questionNo: number; bbox?: BBox; maxScore: number }>,
  pageWidth: number,
  pageHeight: number,
): SegmentationResult {
  const regions: QuestionRegion[] = questions
    .filter((q) => q.bbox !== undefined)
    .map((q) => ({
      questionNo: q.questionNo,
      bbox: q.bbox as BBox,
      source: 'template' as const,
      maxScore: q.maxScore,
    }))
  return { regions, pageWidth, pageHeight, method: 'template' }
}

// ── Otomatik Segmentasyon (şablon yoksa fallback) ─────────────

/** Bir bbox'ın dikey merkezi (0-1000). */
function centerY(b: BBox): number {
  return (b[0] + b[2]) / 2
}

/** İki kutu dikeyde belirgin boşlukla mı ayrılıyor? */
function verticalGap(a: BBox, b: BBox): number {
  // a üstte, b altta varsayımı: b.ymin - a.ymax
  return b[0] - a[2]
}

/**
 * Otomatik soru tespiti: satırları dikey boşluğa göre gruplar.
 *
 * Mantık: soru blokları arasındaki boşluk, blok içi satır boşluğundan büyüktür.
 * Ortalama satır boşluğunun `gapFactor` katından büyük boşluk → yeni soru.
 */
export function segmentAuto(
  lines: TextLineBox[],
  pageWidth: number,
  pageHeight: number,
  opts: { gapFactor?: number } = {},
): SegmentationResult {
  const gapFactor = opts.gapFactor ?? 2.2

  if (lines.length === 0) {
    return { regions: [], pageWidth, pageHeight, method: 'auto' }
  }

  // Dikey sıraya diz
  const sorted = [...lines].sort((a, b) => centerY(a.bbox) - centerY(b.bbox))

  // Ortalama satır-arası boşluk
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.max(0, verticalGap(sorted[i - 1].bbox, sorted[i].bbox)))
  }
  const avgGap = gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0
  const threshold = avgGap * gapFactor

  // v1.10 düzeltmesi: tek boşluk varsa (2 satır), ortalama = o boşluğun
  // kendisidir ve `gap > avgGap*2.2` ASLA doğru olamaz — 2 satır her zaman
  // tek soruya birleşirdi. Tek/az satır durumunda mutlak satır-yüksekliği
  // tabanlı eşik kullanılır: bir satır yüksekliğinden büyük boşluk = yeni soru.
  const avgLineHeight =
    sorted.reduce((s, l) => s + Math.abs(l.bbox[2] - l.bbox[0]), 0) /
    Math.max(1, sorted.length)
  const absoluteThreshold = avgLineHeight * 1.5
  // Az satırda (≤3) oransal eşik güvenilmez → mutlak eşiğe düş
  const useAbsolute = sorted.length <= 3

  // Boşluk eşiği aşılınca yeni grup başlat
  const groups: TextLineBox[][] = [[sorted[0]]]
  for (let i = 1; i < sorted.length; i++) {
    const gap = verticalGap(sorted[i - 1].bbox, sorted[i].bbox)
    const isNewQuestion = useAbsolute
      ? gap > absoluteThreshold
      : gap > threshold && avgGap > 0
    if (isNewQuestion) {
      groups.push([sorted[i]])
    } else {
      groups[groups.length - 1].push(sorted[i])
    }
  }

  // Her grubu tek bir soru kutusuna sar (içindeki satırların birleşik bbox'ı)
  const regions: QuestionRegion[] = groups.map((group, idx) => {
    const ymin = Math.min(...group.map((l) => l.bbox[0]))
    const xmin = Math.min(...group.map((l) => l.bbox[1]))
    const ymax = Math.max(...group.map((l) => l.bbox[2]))
    const xmax = Math.max(...group.map((l) => l.bbox[3]))
    return {
      questionNo: idx + 1,
      bbox: [ymin, xmin, ymax, xmax] as BBox,
      source: 'auto' as const,
    }
  })

  return { regions, pageWidth, pageHeight, method: 'auto' }
}

// ── Kutu → Piksel (crop için) ─────────────────────────────────

/** Normalize bbox'ı gerçek piksel koordinatlarına çevir (crop için). */
export function bboxToPixels(
  bbox: BBox,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const [ymin, xmin, ymax, xmax] = bbox
  return {
    x: (xmin / 1000) * pageWidth,
    y: (ymin / 1000) * pageHeight,
    width: ((xmax - xmin) / 1000) * pageWidth,
    height: ((ymax - ymin) / 1000) * pageHeight,
  }
}

/**
 * Yüksek seviye giriş noktası: şablon varsa onu kullan, yoksa otomatik.
 * "Önce şablon, sonra heuristik" — en güvenilir yol önce denenir.
 */
export function segment(
  pageWidth: number,
  pageHeight: number,
  input: {
    templateQuestions?: Array<{ questionNo: number; bbox?: BBox; maxScore: number }>
    detectedLines?: TextLineBox[]
  },
): SegmentationResult {
  const hasTemplate =
    input.templateQuestions?.some((q) => q.bbox !== undefined) ?? false

  if (hasTemplate) {
    return segmentFromTemplate(input.templateQuestions!, pageWidth, pageHeight)
  }
  return segmentAuto(input.detectedLines ?? [], pageWidth, pageHeight)
}

// ════════════════════════════════════════════════════════════════
// v1.10 — ÇOK SAYFALI SEGMENTASYON
// ChatGPT notu: "ilk sayfa segmentleniyor; çok sayfalı v1.10."
// Bir sınav birden çok sayfaya yayılır; soru numaraları sayfalar
// boyunca SÜREKLİ artar (sayfa 2'nin ilk sorusu, sayfa 1'in son
// sorusundan sonraki numaradır).
// ════════════════════════════════════════════════════════════════

/** Tek bir sayfanın segmentasyon girdisi. */
export interface PageInput {
  pageNumber: number
  pageWidth: number
  pageHeight: number
  templateQuestions?: Array<{ questionNo: number; bbox?: BBox; maxScore: number }>
  detectedLines?: TextLineBox[]
}

/** Çok sayfalı segmentasyon sonucundaki tek bölge — sayfa bilgisi taşır. */
export interface MultiPageRegion extends QuestionRegion {
  pageNumber: number
}

export interface MultiPageResult {
  regions: MultiPageRegion[]
  pageCount: number
  totalQuestions: number
}

/**
 * Çok sayfalı sınavı segmentlere ayırır.
 *
 * Soru numaralandırma kuralı:
 *   - Şablon varsa: şablonun verdiği questionNo'ya GÜVENİLİR (sayfa
 *     atlasa bile şablon doğru numarayı taşır).
 *   - Otomatik tespitte: numaralar sayfalar boyunca süreklidir —
 *     sayfa 1'de 3 soru varsa, sayfa 2 soru 4'ten başlar.
 */
export function segmentMultiPage(pages: PageInput[]): MultiPageResult {
  const allRegions: MultiPageRegion[] = []
  let runningOffset = 0 // otomatik modda süreklilik için

  for (const page of pages) {
    const result = segment(page.pageWidth, page.pageHeight, {
      templateQuestions: page.templateQuestions,
      detectedLines: page.detectedLines,
    })

    for (const region of result.regions) {
      const questionNo =
        result.method === 'template'
          ? region.questionNo // şablon doğru numarayı verir
          : region.questionNo + runningOffset // otomatik: süreklilik

      allRegions.push({
        ...region,
        questionNo,
        pageNumber: page.pageNumber,
      })
    }

    // Otomatik modda sonraki sayfa için offset güncelle
    if (result.method === 'auto') {
      runningOffset += result.regions.length
    }
  }

  return {
    regions: allRegions,
    pageCount: pages.length,
    totalQuestions: allRegions.length,
  }
}
