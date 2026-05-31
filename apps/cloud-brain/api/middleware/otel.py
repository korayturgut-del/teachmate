"""MOCK SCAFFOLD — Phase 1. OpenTelemetry kaldırıldı, yerel log Phase 4'te."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import logging
import time

logger = logging.getLogger("doa.cloud-brain")


class OpenTelemetryMiddleware(BaseHTTPMiddleware):
    """Phase 1: Basit loglama.
    Phase 4: Rust tracing ile değiştirilir, yerel log dosyasına yazar."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response: Response = await call_next(request)
        elapsed = time.perf_counter() - start
        logger.info(
            f"{request.method} {request.url.path} → {response.status_code} "
            f"({elapsed*1000:.1f}ms) [mock]"
        )
        response.headers["X-Trace-Mode"] = "mock-phase1"
        return response
