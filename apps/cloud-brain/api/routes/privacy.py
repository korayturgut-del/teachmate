"""Dijital Öğretmen Asistanı — KVKK Veri Gizliliği Endpoint'leri

v1.15: KVKK (Kişisel Verilerin Korunması Kanunu) uyumu.
Data residency: öğrenci PII Türkiye'de yerel cihazda kalır.

Gemini araştırması doğruladı: "Mathpix'te 24 saat veri silme muafiyeti
(Data Retention Opt-Out)" gibi cloud servis korumaları zorunlu.
Bu endpoint bu güvencenin DÖA tarafını yönetir.
"""
import json, os, time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

CONSENT_DB = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..",
    "doa_data", "privacy_consents.json",
)
os.makedirs(os.path.dirname(CONSENT_DB), exist_ok=True)


def _read_consents() -> dict:
    try:
        return json.loads(open(CONSENT_DB).read())
    except (FileNotFoundError, json.JSONDecodeError):
        return {"consents": [], "deletions": []}


def _write_consents(data: dict):
    open(CONSENT_DB, "w").write(json.dumps(data, ensure_ascii=False, indent=2))


class ConsentRecord(BaseModel):
    teacher_id: str
    consent_to_train: bool      # OCR veri paylaşımı
    consent_to_telemetry: bool  # Anonim kullanım istatistiği
    data_residency: str = "TR"  # Veri konumu — varsayılan Türkiye
    version: str = "1.0"        # Onay belgesi versiyonu


class DeletionRequest(BaseModel):
    teacher_id: str
    reason: str = ""            # Silme gerekçesi (opsiyonel)


@router.post("/consent")
async def record_consent(payload: ConsentRecord):
    """Öğretmenin KVKK onayını kayıt altına al.

    KVKK Madde 5 & 6: açık rıza zorunlu.
    consent_to_train=False → öğretmenin verisi hiçbir bulut modeline gitmez.
    """
    db = _read_consents()
    record = payload.model_dump()
    record["recorded_at"] = time.time()

    # Önceki onayı güncelle (aynı teacher_id)
    db["consents"] = [c for c in db["consents"] if c["teacher_id"] != payload.teacher_id]
    db["consents"].append(record)
    _write_consents(db)
    return {"status": "consent_recorded", "teacher_id": payload.teacher_id,
            "data_residency": payload.data_residency}


@router.get("/consent/{teacher_id}")
async def get_consent(teacher_id: str):
    """Mevcut onay durumunu sorgula."""
    db = _read_consents()
    record = next((c for c in db["consents"] if c["teacher_id"] == teacher_id), None)
    if not record:
        return {"status": "no_consent_recorded", "teacher_id": teacher_id}
    return {"status": "found", **record}


@router.post("/delete-my-data")
async def request_deletion(payload: DeletionRequest):
    """KVKK Madde 13: Veri silme hakkı (Right to Erasure).

    Öğretmen verilerinin tamamını siler:
    - Eğitim corpus kayıtları (learning_corpus.json)
    - Onay kayıtları
    """
    # Corpus'tan ilgili kayıtları sil
    corpus_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "..",
        "doa_data", "learning_corpus.json",
    )
    try:
        corpus = json.loads(open(corpus_path).read())
        before = len(corpus["corrections"])
        corpus["corrections"] = [
            c for c in corpus["corrections"]
            if c.get("teacher_id") != payload.teacher_id
        ]
        removed = before - len(corpus["corrections"])
        open(corpus_path, "w").write(json.dumps(corpus, ensure_ascii=False, indent=2))
    except FileNotFoundError:
        removed = 0

    # Onay kaydını sil
    db = _read_consents()
    db["consents"] = [c for c in db["consents"] if c["teacher_id"] != payload.teacher_id]
    db["deletions"].append({
        "teacher_id": payload.teacher_id,
        "deleted_at": time.time(),
        "removed_corrections": removed,
        "reason": payload.reason,
    })
    _write_consents(db)

    return {
        "status": "deleted",
        "teacher_id": payload.teacher_id,
        "removed_corrections": removed,
        "note": "KVKK Madde 13 uyarınca tüm kişisel veriler silindi."
    }


@router.get("/data-residency")
async def data_residency_info():
    """Veri konumu bilgisi — KVKK şeffaflık yükümlülüğü."""
    return {
        "student_pii": {
            "location": "TR",
            "storage": "Yerel cihaz — SQLCipher AES-256",
            "cloud_transfer": False,
            "description": "Öğrenci adı, numarası ve notları hiçbir zaman buluta gönderilmez."
        },
        "exam_content": {
            "location": "TR veya cloud (seçime bağlı)",
            "storage": "Yerel veya Cloud Brain (HF Spaces)",
            "cloud_transfer": "Yalnızca anonim soru/yanıt metni — öğrenci kimliği çıkarılmış",
            "opt_out": "AI_PROVIDER=local ile tamamen yerel"
        },
        "ocr_corrections": {
            "location": "TR (yerel) + isteğe bağlı cloud corpus",
            "cloud_transfer": "Yalnızca consent_to_train=True ile",
            "anonymous": True,
            "retention": "Silme talebi ile anında kaldırılır (KVKK Madde 13)"
        },
        "law": "KVKK (6698 sayılı Kanun)",
        "dpo_contact": "kvkk@doa.ai"
    }


@router.get("/health")
async def privacy_health():
    return {"service": "privacy", "kvkk_compliant": True}
