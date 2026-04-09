import asyncio
import logging
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException

from app.core.config import settings


logger = logging.getLogger(__name__)


class ModelManager:
    def __init__(self) -> None:
        self.current_model: str | None = None
        self.last_used: datetime | None = None
        self.is_loading: bool = False
        self._lock = asyncio.Lock()

    async def load_model(self, model: str) -> None:
        await self._lock.acquire()
        try:
            now = datetime.now(timezone.utc)

            if self.current_model == model:
                self.last_used = now
                logger.info("Model already loaded: %s at %s", model, now.isoformat())
                return

            self.is_loading = True

            try:
                if self.current_model is not None:
                    await self._unload(self.current_model)

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{settings.OLLAMA_BASE_URL}/api/generate",
                        json={"model": model, "prompt": "", "keep_alive": -1},
                    )
                    response.raise_for_status()
            except httpx.TimeoutException as exc:
                raise HTTPException(status_code=504, detail="Model load timed out") from exc
            except HTTPException:
                raise
            except httpx.HTTPError as exc:
                raise HTTPException(status_code=503, detail="Ollama service unavailable") from exc

            self.current_model = model
            self.last_used = datetime.now(timezone.utc)
            logger.info("Model loaded: %s at %s", model, self.last_used.isoformat())
        finally:
            self.is_loading = False
            if self._lock.locked():
                self._lock.release()

    async def _unload(self, model: str) -> None:
        logger.info("Unloading model: %s at %s", model, datetime.now(timezone.utc).isoformat())
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={"model": model, "prompt": "", "keep_alive": 0},
            )
            response.raise_for_status()

        self.current_model = None

    async def unload_current(self) -> str | None:
        await self._lock.acquire()
        try:
            if self.current_model is None:
                return None

            model_to_unload = self.current_model
            await self._unload(model_to_unload)
            self.last_used = datetime.now(timezone.utc)
            logger.info("Model unloaded: %s at %s", model_to_unload, self.last_used.isoformat())
            return model_to_unload
        finally:
            if self._lock.locked():
                self._lock.release()

    async def get_status(self) -> dict:
        memory_used_gb = 0.0

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/ps")
                response.raise_for_status()
                payload = response.json()

            models = payload.get("models", [])
            if self.current_model:
                for model in models:
                    if model.get("name") == self.current_model:
                        size_vram = model.get("size_vram") or 0
                        memory_used_gb = float(size_vram) / 1_000_000_000
                        break
        except httpx.HTTPError:
            memory_used_gb = 0.0

        idle_seconds = None
        if self.last_used is not None:
            idle_seconds = int((datetime.now(timezone.utc) - self.last_used).total_seconds())

        return {
            "current_model": self.current_model,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "idle_seconds": idle_seconds,
            "is_loading": self.is_loading,
            "memory_used_gb": round(memory_used_gb, 3),
            "ram_free_gb": round(self._read_ram_free_gb(), 3),
        }

    async def auto_unload_if_idle(self, idle_timeout_minutes: int) -> bool:
        await self._lock.acquire()
        try:
            if self.last_used is None or self.current_model is None:
                return False

            idle_seconds = int((datetime.now(timezone.utc) - self.last_used).total_seconds())
            if idle_seconds > idle_timeout_minutes * 60:
                await self._unload(self.current_model)
                self.last_used = datetime.now(timezone.utc)
                logger.info(
                    "Auto-unloaded model after %s seconds idle at %s",
                    idle_seconds,
                    self.last_used.isoformat(),
                )
                return True

            return False
        finally:
            if self._lock.locked():
                self._lock.release()

    @staticmethod
    def _read_ram_free_gb() -> float:
        try:
            with open("/proc/meminfo", "r", encoding="utf-8") as meminfo:
                for line in meminfo:
                    if line.startswith("MemAvailable:"):
                        parts = line.split()
                        if len(parts) >= 2:
                            kb = int(parts[1])
                            return kb / 1_000_000
        except (FileNotFoundError, PermissionError, ValueError):
            return 0.0

        return 0.0


_model_manager: ModelManager | None = None


def get_model_manager() -> ModelManager:
    global _model_manager

    if _model_manager is None:
        _model_manager = ModelManager()

    return _model_manager