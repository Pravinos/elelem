import asyncio
import logging

from app.core.config import settings
from app.services.model_manager import ModelManager


logger = logging.getLogger(__name__)


async def idle_watcher_loop(model_manager: ModelManager, interval_seconds: int = 60):
    while True:
        await asyncio.sleep(interval_seconds)
        unloaded = await model_manager.auto_unload_if_idle(
            idle_timeout_minutes=settings.IDLE_TIMEOUT_MINUTES
        )
        if unloaded:
            logger.info("Idle watcher: unloaded idle model - RAM freed")