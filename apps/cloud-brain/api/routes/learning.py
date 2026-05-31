"""Dijital Öğretmen Asistanı — Öğrenme (Learning) Route'ları

v1.11: Gerçek /api/learning/corrections endpoint + eğitim corpus deposu.

learning-engine paketinin CorrectionStore arayüzünün BULUT tarafıdır.
Cihazdaki learning-engine, consentToTrain=true olan düzeltmeleri buraya
yükler; bu route onları anonim eğitim corpus'unda toplar.

Mimari (master prompt LEARNING LOOP):
  Cihaz: OCR yanlış okur → öğretmen düzeltir → OCRCorrection
       → (A) yerel sözlük anında güncellenir
       → (B) consent varsa → BU ENDPOINT'e yüklenir
  Bulut: 500 yeni örnek → ModelTrainingTriggered → fine-tune

KVKK / Madde 4: Yalnızca anonim "görüntü parçası → doğru metin" çiftleri.
Öğrenci adı/numarası ASLA kabul edilmez — bu route PII alanı barındırmaz.
Depo deseni exam.py ile aynı (JSON-bridge, Phase 4'te SQLCipher).
"""

import json
import os
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# Eğitim corpus deposu — exam.py ile AYNI desen (mevcut şema bozulmadı)
DB_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..",
    "doa_data", "learning_corpus.json",
)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Fine-tune tetikleme eşiği — learning-engine TRAIN_THRESHOLD ile aynı
TRAIN_THRESHOLD = 500


def _read_db() -> dict:
    """Corpus deposundan oku."""
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"corrections": [], "last_train_count": 0}


def _write_db(data: dict) -> None:
    """Corpus deposuna yaz."""
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── İstek/Yanıt modelleri ───────────────────────────────────

class CorrectionUpload(BaseModel):
    """Cihazdan yüklenen tek OCR düzeltme örneği.

    DİKKAT: Bu model bilinçli olarak öğrenci PII alanı İÇERMEZ.
    teacherId anonim bir kimliktir (cihaz kullanıcısı), öğrenci değil.
    """
    correction_id: str
    ocr_text: str = Field(..., description="OCR'ın okuduğu yanlış metin")
    corrected_text: str = Field(..., description="Öğretmenin doğru metni")
    engine: str = Field(..., description="mlkit | apple_vision | paddle_onnx")
    ocr_confidence: float = Field(..., ge=0.0, le=1.0)
    content_type: str = Field(..., description="handwriting | math | printed | ...")
    teacher_id: str
    consent_to_train: bool = Field(..., description="KVKK — eğitim izni zorunlu")
    image_ref: str | None = Field(None, description="Anonim görüntü parçası referansı")


class BatchCorrectionUpload(BaseModel):
    """Çevrimdışı kuyruktan toplu yükleme (sync-engine ile)."""
    corrections: list[CorrectionUpload]


# ── Endpoint'ler ────────────────────────────────────────────

@router.post("/corrections")
async def upload_correction(payload: CorrectionUpload):
    """Tek bir OCR düzeltmesini eğitim corpus'una ekler.

    KVKK koruması: consent_to_train=false ise REDDEDİLİR.
    İzinsiz veri bulut corpus'una hiçbir koşulda girmez.
    """
    if not payload.consent_to_train:
        raise HTTPException(
            status_code=403,
            detail="Eğitim izni (consent_to_train) olmayan veri kabul edilmez (KVKK).",
        )

    db = _read_db()

    # Aynı correction_id tekrar yüklenirse yok say (idempotent)
    existing_ids = {c["correction_id"] for c in db["corrections"]}
    if payload.correction_id in existing_ids:
        return {
            "status": "duplicate",
            "correction_id": payload.correction_id,
            "total_samples": len(db["corrections"]),
        }

    record = payload.model_dump()
    record["uploaded_at"] = time.time()
    db["corrections"].append(record)
    _write_db(db)

    total = len(db["corrections"])
    new_since_train = total - db.get("last_train_count", 0)

    return {
        "status": "accepted",
        "correction_id": payload.correction_id,
        "total_samples": total,
        "new_since_last_train": new_since_train,
        "training_triggered": new_since_train >= TRAIN_THRESHOLD,
    }


@router.post("/corrections/batch")
async def upload_batch(payload: BatchCorrectionUpload):
    """Çevrimdışı kuyruktan toplu düzeltme yükleme.

    İzinsiz örnekler sessizce atlanır, izinli olanlar eklenir.
    """
    db = _read_db()
    existing_ids = {c["correction_id"] for c in db["corrections"]}

    accepted, skipped_consent, skipped_dup = 0, 0, 0
    for item in payload.corrections:
        if not item.consent_to_train:
            skipped_consent += 1
            continue
        if item.correction_id in existing_ids:
            skipped_dup += 1
            continue
        record = item.model_dump()
        record["uploaded_at"] = time.time()
        db["corrections"].append(record)
        existing_ids.add(item.correction_id)
        accepted += 1

    _write_db(db)
    total = len(db["corrections"])

    return {
        "status": "ok",
        "accepted": accepted,
        "skipped_no_consent": skipped_consent,
        "skipped_duplicate": skipped_dup,
        "total_samples": total,
        "new_since_last_train": total - db.get("last_train_count", 0),
    }


@router.get("/corpus/stats")
async def corpus_stats():
    """Eğitim corpus istatistiği — learning-engine.checkTrainingReadiness karşılığı.

    Cihazdaki LearningEngine bu endpoint'i CorrectionStore.corpusStats()
    için kullanır.
    """
    db = _read_db()
    corrections = db["corrections"]

    by_engine: dict[str, int] = {}
    by_content: dict[str, int] = {}
    for c in corrections:
        by_engine[c["engine"]] = by_engine.get(c["engine"], 0) + 1
        by_content[c["content_type"]] = by_content.get(c["content_type"], 0) + 1

    total = len(corrections)
    new_since = total - db.get("last_train_count", 0)
    ready = new_since >= TRAIN_THRESHOLD

    return {
        "total_samples": total,
        "by_engine": by_engine,
        "by_content_type": by_content,
        "new_since_last_train": new_since,
        "ready_to_train": ready,
        "train_threshold": TRAIN_THRESHOLD,
    }


@router.post("/training/mark-complete")
async def mark_training_complete():
    """Fine-tune tamamlandığında çağrılır — sayaç sıfırlanır.

    Bir sonraki ModelTrainingTriggered için 'last_train_count' güncellenir.
    """
    db = _read_db()
    total = len(db["corrections"])
    db["last_train_count"] = total
    _write_db(db)
    return {
        "status": "training_marked_complete",
        "corpus_size_at_train": total,
    }


@router.get("/health")
async def learning_health():
    """Öğrenme servisi sağlık durumu."""
    db = _read_db()
    return {
        "service": "learning",
        "corpus_samples": len(db["corrections"]),
        "train_threshold": TRAIN_THRESHOLD,
    }
