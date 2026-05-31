"""MOCK SCAFFOLD — Phase 1. Gerçek implement Phase 2'de."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_reviews(exam_id: str = None):
    """İnceleme listesi (Mock)"""
    return {"data": [], "mock": True, "message": "Phase 1 mock."}


@router.get("/{review_id}")
async def get_review(review_id: str):
    """İnceleme detayı (Mock)"""
    return {"id": review_id, "mock": True}


@router.put("/{review_id}/annotate")
async def annotate_review(review_id: str, payload: dict):
    """Öğretmen notu ekle (Mock)"""
    return {"id": review_id, "annotated": True, "mock": True}


@router.put("/{review_id}/override")
async def override_grade(review_id: str, payload: dict):
    """Not geçersiz kılma (Mock)"""
    return {"id": review_id, "overridden": True, "mock": True}
