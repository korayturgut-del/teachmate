"""MOCK SCAFFOLD — Phase 1. Gerçek implement Phase 2'de."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_schools():
    """Okul listesi (Mock)"""
    return {
        "data": [
            {"id": 1, "name": "Mock Okul", "city": "İstanbul", "type": "devlet"},
        ],
        "mock": True,
    }


@router.get("/{school_id}")
async def get_school(school_id: int):
    """Okul detayı (Mock)"""
    return {
        "id": school_id,
        "name": "Mock Okul",
        "city": "İstanbul",
        "district": "Kadıköy",
        "type": "devlet",
        "mock": True,
    }


@router.post("/")
async def create_school(payload: dict):
    """Yeni okul ekle (Mock)"""
    return {"id": 1, "mock": True}
