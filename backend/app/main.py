import os
import asyncio
from contextlib import asynccontextmanager
from contextlib import suppress

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware.auth import APIKeyMiddleware
from app.routers.chat import router as chat_router
from app.routers.models import router as models_router
from app.services.idle_watcher import idle_watcher_loop
from app.services.model_manager import get_model_manager
from app.services.ollama import check_ollama_health


load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager = get_model_manager()
    task = asyncio.create_task(idle_watcher_loop(manager))
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        await manager.unload_current()


app = FastAPI(title="Ollama Proxy API", lifespan=lifespan)

app.add_middleware(APIKeyMiddleware)

environment = os.getenv("ENVIRONMENT", "development").lower()
if environment == "development":
    allowed_origins = ["*"]
else:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "")
    allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(models_router, prefix="/api", tags=["models"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "ollama": await check_ollama_health()}
