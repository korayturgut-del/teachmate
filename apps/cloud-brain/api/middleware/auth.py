"""MOCK SCAFFOLD — Phase 1. Python-jose kaldırıldı, yerel auth engine Phase 2'de."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class AuthMiddleware(BaseHTTPMiddleware):
    """Phase 1: Tüm isteklere izin verir.
    Phase 2: JWT doğrulama + rol kontrolü (packages/auth-engine/)"""

    async def dispatch(self, request: Request, call_next):
        # Phase 1 — herkese açık
        # Phase 2'de Authorization header kontrolü eklenecek
        response: Response = await call_next(request)
        response.headers["X-Auth-Mode"] = "mock-phase1"
        return response
