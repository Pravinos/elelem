import os

from fastapi import status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path

        if (
            path in {"/docs", "/redoc", "/openapi.json", "/api/health"}
            or not path.startswith("/api")
        ):
            return await call_next(request)

        expected_key = os.getenv("API_KEY", "")
        provided_key = request.headers.get("X-API-Key")

        if not expected_key or provided_key != expected_key:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or missing API key"},
            )

        return await call_next(request)
