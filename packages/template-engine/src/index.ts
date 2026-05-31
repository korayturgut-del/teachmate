/**
 * @doa/template-engine
 *
 * Sınav Şablonu + Versiyonlama — ADR-015 (MANTIK-HATASI-1 çözümü).
 *
 * Sorun: Öğretmen sınavı düzenleyince aynı sınavın birden çok basılı versiyonu
 * dolaşıma girer; AI hangi versiyona göre puanlayacağını bilemez → kaos.
 *
 * Çözüm:
 *  - Her şablon değişikliğinde yeni versiyon (`TemplateVersionCreated`).
 *  - Her QR kodu `exam_id-vN` taşır (örn: `e0001-v2`).
 *  - Şablon içeriğinden SHA-256 hash → aynı şablon yanlışlıkla yeniden basılırsa tespit.
 *  - Tarama sırasında QR versiyonu Answer Key versiyonuyla eşleşmezse `StudentMatchRejected`.
 */

// ── Tipler ─────────────────────────────────────────────────────

export interface TemplateQuestion {
  questionNo: number
  type: 'closed' | 'open'
  /** Soru metni veya yer-tutucu */
  prompt: string
  /** Sayfadaki konum (QR/segment eşlemesi için) — [ymin,xmin,ymax,xmax] / 1000 */
  bbox?: [number, number, number, number]
  maxScore: number
}

export interface ExamTemplate {
  examId: string
  title: string
  subject: string
  questions: TemplateQuestion[]
  /** A4 dikey/yatay vb. */
  pageSize: 'A4P' | 'A4L'
}

export interface TemplateVersion {
  examId: string
  version: number
  /** SHA-256 içerik hash'i (çift basım tespiti) */
  contentHash: string
  /** QR yükü: "examId-vN" */
  qrPayload: string
  createdAt: string
}

export interface VersionMatch {
  matches: boolean
  scannedVersion: number
  answerKeyVersion: number
  /** Eşleşmezse audit reason */
  reason?: 'version_mismatch'
}

/** Async SHA-256 köprüsü (Web Crypto / Rust). Test edilebilirlik için enjekte. */
export type Sha256Fn = (input: string) => Promise<string>

/** Tarayıcıda Web Crypto ile SHA-256 (varsayılan). */
export const webCryptoSha256: Sha256Fn = async (input: string) => {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── QR yük çözümleme ───────────────────────────────────────────

/** "e0001-v2" → { examId: "e0001", version: 2 } */
export function parseQrPayload(payload: string): { examId: string; version: number } | null {
  const m = /^(.+)-v(\d+)$/.exec(payload.trim())
  if (!m) return null
  return { examId: m[1], version: Number(m[2]) }
}

export function buildQrPayload(examId: string, version: number): string {
  return `${examId}-v${version}`
}

// ── Şablon içeriğini deterministik string'e çevir (hash girdisi) ──

function canonicalize(template: ExamTemplate): string {
  // Soruları numaraya göre sırala → aynı içerik her zaman aynı hash
  const questions = [...template.questions]
    .sort((a, b) => a.questionNo - b.questionNo)
    .map((q) => `${q.questionNo}|${q.type}|${q.prompt}|${q.maxScore}`)
    .join('\n')
  return `${template.examId}|${template.title}|${template.subject}|${template.pageSize}\n${questions}`
}

// ── Template Engine ────────────────────────────────────────────

export class TemplateEngine {
  constructor(private sha256: Sha256Fn = webCryptoSha256) {}

  /**
   * Şablondan yeni versiyon üret. İçerik hash'i hesaplanır, QR yükü oluşturulur.
   * `prevHash` verilirse ve aynıysa → içerik değişmemiş, yeni versiyon gerekmez.
   */
  async createVersion(
    template: ExamTemplate,
    nextVersion: number,
    prevHash?: string,
  ): Promise<{ version: TemplateVersion; changed: boolean }> {
    const contentHash = await this.sha256(canonicalize(template))
    const changed = contentHash !== prevHash
    const version: TemplateVersion = {
      examId: template.examId,
      version: nextVersion,
      contentHash,
      qrPayload: buildQrPayload(template.examId, nextVersion),
      createdAt: new Date().toISOString(),
    }
    return { version, changed }
  }

  /**
   * Taranan QR'ın versiyonu, kullanılan Answer Key versiyonuyla eşleşiyor mu?
   * Eşleşmezse StudentMatchRejected tetiklenmeli (reason: version_mismatch).
   */
  verifyScan(qrPayload: string, answerKeyVersion: number): VersionMatch {
    const parsed = parseQrPayload(qrPayload)
    const scannedVersion = parsed?.version ?? -1
    const matches = scannedVersion === answerKeyVersion
    return {
      matches,
      scannedVersion,
      answerKeyVersion,
      reason: matches ? undefined : 'version_mismatch',
    }
  }
}
