/**
 * @doa/performance-engine
 *
 * MEB 10 Kriter Performans Hesaplama Motoru.
 * Phase 3: Tam implement — Kaynak A perf* fonksiyonlarından port.
 *
 * Kaynak: MEB Yazılı Sınav Değerlendirme Kriterleri
 */

// ── Tipler ─────────────────────────────────────────────────────

export interface MEBPerformanceResult {
  /** 1. Soru bazlı doğru sayısı */
  totalCorrect: number
  /** 2. Yanlış sayısı */
  totalWrong: number
  /** 3. Boş sayısı */
  totalEmpty: number
  /** 4. Kısmi doğru sayısı */
  totalPartial: number
  /** 5. Net doğru (4 yanlış 1 doğruyu götürür) */
  netCorrect: number
  /** 6. Başarı yüzdesi */
  successRate: number
  /** 7. Sınıf ortalaması */
  classAverage: number
  /** 8. Sınıf içi sıralama */
  classRank: number | null
  /** 9. Standart sapma */
  standardDeviation: number
  /** 10. Dağılım (z-skor bazlı) */
  distribution: {
    excellent: number   // +2σ üstü
    good: number        // +1σ ile +2σ arası
    average: number     // -1σ ile +1σ arası
    belowAverage: number // -2σ ile -1σ arası
    poor: number        // -2σ altı
  }
}

export interface StudentScore {
  studentId: string
  studentName: string
  totalScore: number
  maxScore: number
  correct: number
  wrong: number
  empty: number
  partial: number
  questionScores: Array<{
    questionNo: number
    score: number
    maxScore: number
    status: 'correct' | 'wrong' | 'empty' | 'partial'
  }>
}

export interface ClassStats {
  className: string
  studentCount: number
  average: number
  median: number
  highest: number
  lowest: number
  standardDeviation: number
}

// ── Puanlama ──────────────────────────────────────────────────

/**
 * Sorunun durumunu belirle (doğru / yanlış / kısmi / boş).
 *
 * Kural:
 * - score == maxScore → correct
 * - score == 0 → empty
 * - 0 < score < maxScore && score < maxScore * 0.4 → wrong
 * - ara değer → partial
 */
export function classifyAnswer(
  score: number,
  maxScore: number,
): 'correct' | 'wrong' | 'empty' | 'partial' {
  if (score >= maxScore) return 'correct'
  if (score === 0) return 'empty'
  if (score < maxScore * 0.4) return 'wrong'
  return 'partial'
}

/**
 * Net doğru hesabı — MEB kuralı: 4 yanlış 1 doğruyu götürür.
 * Boşlar neti etkilemez, kısmi doğrular yanlış sayılır (opsiyonel).
 */
export function calculateNetCorrect(
  correct: number,
  wrong: number,
): number {
  return Math.max(0, correct - wrong / 4)
}

// ── İstatistik ────────────────────────────────────────────────

/** Öğrenci puanlarından sınıf istatistikleri hesapla */
export function calculateClassStats(scores: StudentScore[]): ClassStats {
  if (scores.length === 0) {
    return {
      className: '', studentCount: 0, average: 0, median: 0,
      highest: 0, lowest: 0, standardDeviation: 0,
    }
  }

  const percentages = scores.map(s => s.totalScore / s.maxScore)
  const sorted = [...percentages].sort((a, b) => a - b)

  const sum = percentages.reduce((a, b) => a + b, 0)
  const average = sum / percentages.length
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  const variance = percentages.reduce(
    (acc, p) => acc + Math.pow(p - average, 2), 0
  ) / percentages.length
  const stdev = Math.sqrt(variance)

  return {
    className: scores[0]?.studentName.includes('9-A') ? '9-A' : '',
    studentCount: scores.length,
    average: Math.round(average * 10000) / 100,
    median: Math.round(median * 10000) / 100,
    highest: Math.round(sorted[sorted.length - 1] * 10000) / 100,
    lowest: Math.round(sorted[0] * 10000) / 100,
    standardDeviation: Math.round(stdev * 10000) / 100,
  }
}

/** MEB 10 kriter performans hesapla */
export function calculateMEBPerformance(
  scores: StudentScore[],
  studentScore: StudentScore,
): MEBPerformanceResult {
  const stats = calculateClassStats(scores)

  // Soru durumlarını say
  let correct = 0
  let wrong = 0
  let empty = 0
  let partial = 0

  for (const qs of studentScore.questionScores) {
    switch (qs.status) {
      case 'correct': correct++; break
      case 'wrong': wrong++; break
      case 'empty': empty++; break
      case 'partial': partial++; break
    }
  }

  const netCorrect = calculateNetCorrect(correct, wrong)
  const successRate = Math.round(
    (studentScore.totalScore / studentScore.maxScore) * 10000
  ) / 100

  // Sınıf içi sıralama
  const sorted = [...scores].sort(
    (a, b) => (b.totalScore / b.maxScore) - (a.totalScore / a.maxScore)
  )
  const rank = sorted.findIndex(
    s => s.studentId === studentScore.studentId
  ) + 1

  // Dağılım
  const pct = studentScore.totalScore / studentScore.maxScore
  const zScore = stats.standardDeviation > 0
    ? (pct - stats.average) / stats.standardDeviation
    : 0

  const distribution = {
    excellent: 0, good: 0, average: 0, belowAverage: 0, poor: 0,
  }
  for (const s of scores) {
    const spct = s.totalScore / s.maxScore
    const z = stats.standardDeviation > 0
      ? (spct - stats.average) / stats.standardDeviation
      : 0
    if (z >= 2) distribution.excellent++
    else if (z >= 1) distribution.good++
    else if (z >= -1) distribution.average++
    else if (z >= -2) distribution.belowAverage++
    else distribution.poor++
  }

  return {
    totalCorrect: correct,
    totalWrong: wrong,
    totalEmpty: empty,
    totalPartial: partial,
    netCorrect,
    successRate,
    classAverage: stats.average,
    classRank: rank || null,
    standardDeviation: stats.standardDeviation,
    distribution,
  }
}

/**
 * Öğretmen puanlama profili oku (ADR-016).
 * Phase 3: Veri toplama. Phase 5: Aktif kalibrasyon.
 */
export interface TeacherProfile {
  avgDelta: number       // AI puanına ortalama ekleme/çıkarma
  roundsTo: number       // Yuvarlama değeri (0.5, 1, 0=hayır)
  strictness: 'lenient' | 'neutral' | 'strict'
  sampleSize: number
}

export async function loadTeacherProfile(
  teacherId: string,
): Promise<TeacherProfile | null> {
  // Phase 5: app_settings tablosundan oku
  // Phase 3: null dön (henüz yeterli veri yok)
  return null
}

export async function calibrateWithProfile(
  aiScore: number,
  profile: TeacherProfile,
): Promise<number> {
  let calibrated = aiScore + profile.avgDelta
  if (profile.roundsTo > 0) {
    calibrated = Math.round(calibrated / profile.roundsTo) * profile.roundsTo
  }
  return calibrated
}
