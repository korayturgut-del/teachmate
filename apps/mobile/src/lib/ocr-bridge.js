"use strict";
/**
 * apps/mobile/src/lib/ocr-bridge.ts
 *
 * v1.13 — Gerçek OCR Pipeline Köprüsü
 *
 * react-native-vision-camera-ocr-plus → decision-engine zinciri.
 * Master prompt: "do NOT write a new native bridge — this maintained
 * package exists". Bu dosya o paketin API'sini kullanır, native bridge yazmaz.
 *
 * Akış:
 *   Fotoğraf URI → [ocr-plus ML Kit] → OCRResult
 *               → [decision-engine.decide()] → route
 *               → local_resolve: answer-key eşleştirme
 *               → cloud_escalate: Cloud Brain API
 *               → offline_queue: yerel kuyruk
 *
 * Cihaz seçimi (master prompt ADR-019):
 *   Android → ML Kit Text Recognition v2 (ocr-plus içinde)
 *   iOS     → Apple Vision Framework (ocr-plus içinde, iOS ≥ 16)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectOcrEngine = detectOcrEngine;
exports.runMobileOcr = runMobileOcr;
exports.decideRoute = decideRoute;
exports.extractQrFromOcrText = extractQrFromOcrText;
exports.runMobilePipeline = runMobilePipeline;
exports.formatCorrectionForLearning = formatCorrectionForLearning;
exports.createQrBridgeSession = createQrBridgeSession;
// ── Platform Tespit ───────────────────────────────────────────────────
const react_native_1 = require("react-native");
function detectOcrEngine() {
    return react_native_1.Platform.OS === 'ios' ? 'apple_vision' : 'mlkit';
}
// ── OCR Çalıştırıcı ───────────────────────────────────────────────────
/**
 * Fotoğraftan OCR çalıştırır.
 *
 * Gerçek implement: scanOCR('react-native-vision-camera-ocr-plus') kullanır.
 * Bu paket ML Kit (Android) / Apple Vision (iOS) platformunu otomatik seçer.
 * Master prompt: "do NOT write a new native bridge — this maintained package exists"
 */
async function runMobileOcr(photoUri, 
/** Türkçe karakter desteği zorunlu (madde 5) */
lang = 'tr') {
    const engine = detectOcrEngine();
    const t0 = Date.now();
    try {
        // Gerçek çağrı (react-native-vision-camera-ocr-plus kurulunca aktif):
        // const { scanOCR } = await import('react-native-vision-camera-ocr-plus')
        // const frame = await scanOCR(photoUri, { language: lang })
        // v1.13 stub — paket yüklü değilken tip-güvenli fallback
        // Gerçek cihazda paket kurulunca bu satır kaldırılır:
        const frame = await _stubOcrResult(photoUri);
        const confidence = frame.confidence ?? computeAvgConfidence(frame.blocks);
        return {
            rawText: frame.text,
            blocks: frame.blocks,
            confidence,
            engine,
            durationMs: Date.now() - t0,
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`OCR başarısız (${engine}): ${message}`);
    }
}
/** Blok listesinden ortalama güven hesapla */
function computeAvgConfidence(blocks) {
    if (blocks.length === 0)
        return 0;
    const sum = blocks.reduce((s, b) => s + b.confidence, 0);
    return sum / blocks.length;
}
// ── Decision Engine Karar Fonksiyonu ─────────────────────────────────
/**
 * OCR sonucunu decision-engine'e verir, route belirler.
 * Gerçek projede: import { decide } from '@doa/decision-engine'
 */
function decideRoute(ocr, context) {
    // Karar tablosu (ADR-018, master prompt routing table):
    //   printed, conf ≥ 0.95 → local_resolve, no AI
    //   composition / open text → cloud: DeepSeek
    //   poor handwriting < 0.55 → cloud: Gemini Vision + review
    //   offline → offline_queue
    if (!context.isOnline) {
        return {
            route: 'offline_queue',
            reason: 'İnternet bağlantısı yok — ADR-013 kuyruğuna eklendi',
            requiresTeacherReview: false,
            estimatedCost: 'free',
        };
    }
    if (ocr.confidence >= 0.95 && context.questionType === 'closed') {
        return {
            route: 'local_resolve',
            reason: `Yüksek güven (${(ocr.confidence * 100).toFixed(0)}%) + kapalı uçlu → yerel`,
            requiresTeacherReview: false,
            estimatedCost: 'free',
        };
    }
    if (ocr.confidence < 0.55) {
        return {
            route: 'cloud_escalate',
            reason: `Düşük güven (${(ocr.confidence * 100).toFixed(0)}%) → Gemini Vision + öğretmen incelemesi`,
            requiresTeacherReview: true,
            estimatedCost: 'cloud',
        };
    }
    return {
        route: 'cloud_escalate',
        reason: `Açık uçlu veya orta güven → DeepSeek değerlendirmesi`,
        requiresTeacherReview: ocr.confidence < 0.70,
        estimatedCost: 'cloud',
    };
}
// ── QR Tespit (ADR-015) ────────────────────────────────────────────────
/**
 * OCR metninde ADR-015 QR payload'ı ara.
 * Kamera ile barcode tarama: react-native-vision-camera-barcodes kullanır.
 * OCR metninde de "eXXXX-vN" pattern'i aranır (fallback).
 */
function extractQrFromOcrText(rawText) {
    // Format: "eXXXX-vN" veya "exam=XXXX&version=N"
    const dashV = rawText.match(/\b([a-z0-9-]+-v\d+)\b/i);
    if (dashV)
        return dashV[1];
    const query = rawText.match(/exam=([^&\s]+)&version=(\d+)/);
    if (query)
        return `exam=${query[1]}&version=${query[2]}`;
    return undefined;
}
// ── Tam Pipeline ──────────────────────────────────────────────────────
/**
 * Mobil sınav kağıdı okuma pipeline'ı — tek çağrı.
 *
 * 1. OCR çalıştır (ML Kit / Apple Vision)
 * 2. QR payload'ı bul (ADR-015)
 * 3. Decision Engine ile route belirle
 * 4. Sonuç döndür (UI QuickReview'a gider)
 */
async function runMobilePipeline(photoUri, context) {
    // 1. OCR
    const ocr = await runMobileOcr(photoUri);
    // 2. QR tespit (ADR-015 — exam_id + template_version)
    const qrPayload = extractQrFromOcrText(ocr.rawText);
    // 3. Decision Engine
    const decision = decideRoute(ocr, {
        questionType: context.questionType ?? 'open',
        teacherId: context.teacherId,
        isOnline: context.isOnline,
        examId: context.examId,
        questionNo: context.questionNo ?? 1,
    });
    return { ocr, decision, qrPayload };
}
/** v1.11'deki LearningEngine.recordCorrection'a iletilecek veriyi formatlar */
function formatCorrectionForLearning(input) {
    return {
        ocrText: input.ocrText,
        correctedText: input.correctedText,
        engine: input.engine,
        ocrConfidence: input.ocrConfidence,
        contentType: input.contentType,
        teacherId: input.teacherId,
        consentToTrain: input.consentToTrain,
    };
}
/**
 * Mobil oturumundan QR köprüsü yükü oluşturur.
 * sync-engine'in SyncEngine.createOutgoingPayload() + splitForQr() kullanır.
 * Gerçek projede: import { SyncEngine } from '@doa/sync-engine'
 */
async function createQrBridgeSession(events, sessionKey, 
/** fetch veya custom encrypt fn */
encrypt, sha256) {
    const plaintext = JSON.stringify(events);
    const { ciphertext, nonce } = await encrypt(plaintext, sessionKey);
    const checksum = await sha256(plaintext);
    const payload = {
        version: '1.0-doa',
        sessionId: `mobile_${Date.now()}`,
        direction: 'mobile_to_desktop',
        encryptedEvents: ciphertext,
        nonce,
        checksum,
        itemCount: events.length,
    };
    // QR_CHUNK_BYTES: 1800 (sync-engine sabiti)
    const full = JSON.stringify(payload);
    const CHUNK = 1800;
    const chunks = [];
    const total = Math.ceil(full.length / CHUNK);
    for (let i = 0; i < total; i++) {
        const slice = full.slice(i * CHUNK, (i + 1) * CHUNK);
        chunks.push(`DOA-SYNC|${i + 1}/${total}|${slice}`);
    }
    return {
        qrChunks: chunks,
        totalChunks: total,
        sessionKey,
        eventCount: events.length,
    };
}
// ── Stub OCR (test / paket yüklü değilken) ───────────────────────────
async function _stubOcrResult(photoUri) {
    // Gerçek paketi simüle eder — paket kurulunca BU FONKSİYON SİLİNİR
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
    return {
        text: 'Türkçe el yazısı metni — stub. Gerçek ML Kit paketi kurulunca değişecek.',
        confidence: 0.72 + Math.random() * 0.25,
        blocks: [
            {
                text: 'Soru 1 yanıtı',
                confidence: 0.88,
                lines: [{ text: 'Soru 1 yanıtı', words: [
                            { text: 'Soru', confidence: 0.92, boundingBox: { x: 10, y: 10, width: 60, height: 20 } },
                            { text: '1', confidence: 0.95, boundingBox: { x: 75, y: 10, width: 15, height: 20 } },
                        ] }],
            },
        ],
    };
}
