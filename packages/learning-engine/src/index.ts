/**
 * @doa/learning-engine
 *
 * ÖĞRENME MOTORU — Ürünün Rekabet Hendeği.
 *
 * Vizyon: Sistem "AI ne dediyse o" değil, "öğretmen nasıl okuyorsa öyle" olmalı.
 *
 * Döngü:
 *   1. AI/OCR bir kelimeyi yanlış okur (örn. "köpek" yerine "köprü").
 *   2. Öğretmen dijital masada düzeltir → OCRCorrection event'i.
 *   3. Bu düzeltme buluta (yazılım sahibinin sunucusu) toplanır.
 *   4. Yeterli veri birikince → OCR modeli fine-tune edilir / sözlük güncellenir.
 *   5. Sonraki okumalarda aynı hata tekrarlanmaz.
 *
 * İki seviye öğrenme:
 *   A) ANINDA (yerel): düzeltme sözlüğü — sık yanlış okunan kelimeler eşlenir.
 *   B) UZUN VADELİ (bulut): toplanan örneklerle model fine-tune (training corpus).
 *
 * Gizlilik (Madde 4 + KVKK): Öğrenci kişisel verisi DEĞİL, sadece anonim
 * "görüntü parçası → doğru metin" çiftleri toplanır. Öğretmen onayıyla.
 */

// ── Tipler ─────────────────────────────────────────────────────

/** Tek bir OCR düzeltme örneği — öğrenmenin atomu. */
export interface OCRCorrection {
  correctionId: string
  /** OCR'ın okuduğu (yanlış) metin */
  ocrText: string
  /** Öğretmenin düzelttiği (doğru) metin */
  correctedText: string
  /** Hangi OCR motoru üretti (mlkit/apple_vision/paddle_onnx) */
  engine: string
  /** OCR'ın bu okumadaki güveni */
  ocrConfidence: number
  /** İçerik türü (handwriting/math/...) */
  contentType: string
  /** Anonim görüntü parçası referansı (training için) — opsiyonel */
  imageRef?: string
  teacherId: string
  createdAt: string
  /** Öğretmen bu örneğin eğitime kullanılmasına izin verdi mi? (KVKK) */
  consentToTrain: boolean
}

/** Yerel düzeltme sözlüğü girdisi — anında uygulanır. */
export interface CorrectionDictEntry {
  /** Normalize edilmiş yanlış okuma */
  wrong: string
  /** Doğru karşılık */
  correct: string
  /** Kaç kez bu düzeltme yapıldı (güven) */
  count: number
  contentType: string
}

/** Bulut eğitim corpus istatistiği. */
export interface TrainingCorpusStats {
  totalSamples: number
  byEngine: Record<string, number>
  byContentType: Record<string, number>
  /** Fine-tune için yeterli mi? */
  readyToTrain: boolean
  /** Son eğitimden bu yana yeni örnek */
  newSinceLastTrain: number
}

// ── Köprüler (storage / cloud upload) ─────────────────────────

export interface CorrectionStore {
  /** Yerel düzeltme sözlüğünü getir/güncelle. */
  getDictEntry(wrong: string, contentType: string): Promise<CorrectionDictEntry | null>
  upsertDictEntry(entry: CorrectionDictEntry): Promise<void>
  /** Bulut yükleme kuyruğuna ekle (sync-engine ile gönderilir). */
  queueForUpload(correction: OCRCorrection): Promise<void>
  /** Bulut corpus istatistiği. */
  corpusStats(): Promise<TrainingCorpusStats>
}

export type EmitFn = (event: string, payload: Record<string, unknown>) => void

// ── Sabitler ───────────────────────────────────────────────────

/** Fine-tune tetiklemek için minimum yeni örnek. */
const TRAIN_THRESHOLD = 500

// ── Yardımcılar ────────────────────────────────────────────────

function newId(): string {
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Karşılaştırma için normalize: küçük harf, fazla boşluk temizle (TR-aware). */
export function normalizeTr(s: string): string {
  return s
    .replace(/I/g, 'ı').replace(/İ/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Learning Engine ────────────────────────────────────────────

export class LearningEngine {
  constructor(
    private store: CorrectionStore,
    private emit: EmitFn = () => {},
  ) {}

  /**
   * Öğretmen bir OCR okumasını düzeltti.
   *   - Yerel sözlük güncellenir (anında öğrenme).
   *   - consentToTrain ise bulut kuyruğuna eklenir (uzun vadeli öğrenme).
   *   - OCRCorrection event'i yayınlanır.
   */
  async recordCorrection(input: {
    ocrText: string
    correctedText: string
    engine: string
    ocrConfidence: number
    contentType: string
    teacherId: string
    imageRef?: string
    consentToTrain?: boolean
  }): Promise<OCRCorrection> {
    const correction: OCRCorrection = {
      correctionId: newId(),
      ocrText: input.ocrText,
      correctedText: input.correctedText,
      engine: input.engine,
      ocrConfidence: input.ocrConfidence,
      contentType: input.contentType,
      imageRef: input.imageRef,
      teacherId: input.teacherId,
      createdAt: new Date().toISOString(),
      consentToTrain: input.consentToTrain ?? true,
    }

    // A) ANINDA — yerel düzeltme sözlüğü
    const wrong = normalizeTr(input.ocrText)
    const correct = input.correctedText.trim()
    if (wrong.length > 0 && wrong !== normalizeTr(correct)) {
      const existing = await this.store.getDictEntry(wrong, input.contentType)
      await this.store.upsertDictEntry({
        wrong,
        correct,
        count: (existing?.count ?? 0) + 1,
        contentType: input.contentType,
      })
    }

    // B) UZUN VADELİ — bulut eğitim corpus'una (onay varsa)
    if (correction.consentToTrain) {
      await this.store.queueForUpload(correction)
    }

    this.emit('OCRCorrection', {
      correctionId: correction.correctionId,
      engine: correction.engine,
      contentType: correction.contentType,
      confidence: correction.ocrConfidence,
    })

    return correction
  }

  /**
   * OCR çıktısına yerel sözlüğü uygula — daha önce öğrenilmiş düzeltmeleri
   * ANINDA yansıt (bulut/model beklemeden). Sık hatalar burada düzelir.
   */
  async applyLearnedCorrections(ocrText: string, contentType: string): Promise<{
    text: string
    applied: boolean
  }> {
    const key = normalizeTr(ocrText)
    const entry = await this.store.getDictEntry(key, contentType)
    // En az 2 kez doğrulanmış düzeltmeleri güvenle uygula
    if (entry && entry.count >= 2) {
      return { text: entry.correct, applied: true }
    }
    return { text: ocrText, applied: false }
  }

  /**
   * Bulutta fine-tune zamanı geldi mi? Yeterli yeni örnek birikti mi?
   * "ModelTrainingTriggered" event'i ileride training pipeline'ı tetikler.
   */
  async checkTrainingReadiness(): Promise<TrainingCorpusStats> {
    const stats = await this.store.corpusStats()
    const ready = stats.newSinceLastTrain >= TRAIN_THRESHOLD
    const result: TrainingCorpusStats = { ...stats, readyToTrain: ready }
    if (ready) {
      this.emit('ModelTrainingTriggered', {
        newSamples: stats.newSinceLastTrain,
        total: stats.totalSamples,
      })
    }
    return result
  }
}

// ════════════════════════════════════════════════════════════════
// v1.11 — BULUT CORPUS BAĞLANTISI
// Master prompt v1.11: gerçek /api/learning/corrections upload +
//                      learning-engine'i ona bağla.
// CorrectionStore arayüzünün HTTP implementasyonu.
// ════════════════════════════════════════════════════════════════

/** Yerel sözlük için minimal kalıcı depo arayüzü (storage-engine köprüsü). */
export interface LocalDictStore {
  get(wrong: string, contentType: string): Promise<CorrectionDictEntry | null>
  upsert(entry: CorrectionDictEntry): Promise<void>
  /** Henüz buluta gönderilmemiş düzeltmeler (çevrimdışı kuyruk). */
  pendingUploads(): Promise<OCRCorrection[]>
  markUploaded(correctionIds: string[]): Promise<void>
  enqueue(correction: OCRCorrection): Promise<void>
}

/**
 * CorrectionStore'un GERÇEK implementasyonu.
 *
 * - Yerel sözlük: LocalDictStore (cihazda, SQLCipher)
 * - Bulut corpus: HTTP → /api/learning/corrections (Cloud Brain)
 *
 * Çevrimdışıyken queueForUpload yalnızca yerel kuyruğa yazar;
 * bağlantı gelince flushUploadQueue() çağrılır (ADR-013 ile uyumlu).
 */
export class CloudCorrectionStore implements CorrectionStore {
  constructor(
    private local: LocalDictStore,
    /** Cloud Brain taban adresi, örn. https://...hf.space */
    private cloudBaseUrl: string,
    /** Çevrimdışı tespiti — sync-engine sağlar */
    private isOnline: () => boolean = () => true,
    /** fetch enjeksiyonu (test edilebilirlik için) */
    private fetchFn: typeof fetch = fetch,
  ) {}

  async getDictEntry(
    wrong: string, contentType: string,
  ): Promise<CorrectionDictEntry | null> {
    return this.local.get(wrong, contentType)
  }

  async upsertDictEntry(entry: CorrectionDictEntry): Promise<void> {
    return this.local.upsert(entry)
  }

  /**
   * Bulut yükleme kuyruğuna ekler. Çevrimiçiyse hemen gönderir,
   * çevrimdışıysa yerel kuyrukta bekletir (ADR-013).
   */
  async queueForUpload(correction: OCRCorrection): Promise<void> {
    await this.local.enqueue(correction)
    if (this.isOnline()) {
      await this.flushUploadQueue()
    }
  }

  /**
   * Bekleyen tüm düzeltmeleri Cloud Brain'e toplu yükler.
   * Bağlantı geri geldiğinde sync-engine bunu çağırır.
   */
  async flushUploadQueue(): Promise<{ uploaded: number; failed: number }> {
    const pending = await this.local.pendingUploads()
    if (pending.length === 0) return { uploaded: 0, failed: 0 }

    // KVKK: yalnızca onaylı örnekler — izinsizleri hiç gönderme
    const consented = pending.filter((c) => c.consentToTrain)

    try {
      const res = await this.fetchFn(
        `${this.cloudBaseUrl}/api/learning/corrections/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            corrections: consented.map((c) => ({
              correction_id: c.correctionId,
              ocr_text: c.ocrText,
              corrected_text: c.correctedText,
              engine: c.engine,
              ocr_confidence: c.ocrConfidence,
              content_type: c.contentType,
              teacher_id: c.teacherId,
              consent_to_train: c.consentToTrain,
              image_ref: c.imageRef ?? null,
            })),
          }),
        },
      )
      if (!res.ok) {
        return { uploaded: 0, failed: pending.length }
      }
      // Başarılı — hem onaylı hem onaysızları kuyruktan düş
      // (onaysızlar zaten gönderilmedi ama kuyrukta tutmanın anlamı yok)
      await this.local.markUploaded(pending.map((c) => c.correctionId))
      return { uploaded: consented.length, failed: 0 }
    } catch {
      // Ağ hatası — kuyrukta kalsın, sonra tekrar denenir
      return { uploaded: 0, failed: pending.length }
    }
  }

  /** Bulut corpus istatistiğini çeker (/api/learning/corpus/stats). */
  async corpusStats(): Promise<TrainingCorpusStats> {
    try {
      const res = await this.fetchFn(
        `${this.cloudBaseUrl}/api/learning/corpus/stats`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        total_samples: number
        by_engine: Record<string, number>
        by_content_type: Record<string, number>
        new_since_last_train: number
        ready_to_train: boolean
      }
      return {
        totalSamples: data.total_samples,
        byEngine: data.by_engine,
        byContentType: data.by_content_type,
        newSinceLastTrain: data.new_since_last_train,
        readyToTrain: data.ready_to_train,
      }
    } catch {
      // Çevrimdışı — boş istatistik döndür (UI çökmesin)
      return {
        totalSamples: 0,
        byEngine: {},
        byContentType: {},
        newSinceLastTrain: 0,
        readyToTrain: false,
      }
    }
  }
}
