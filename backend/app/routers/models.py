from fastapi import APIRouter, HTTPException
import httpx
from pydantic import BaseModel

from app.services.model_manager import get_model_manager
from app.services.ollama import get_models


router = APIRouter()


class ModelLoadRequest(BaseModel):
    model: str


@router.get("/models")
async def list_models():
    try:
        models = await get_models()
        return {"models": models}
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Ollama error: {exc}") from exc


@router.get("/models/status")
async def model_status():
    model_manager = get_model_manager()
    return await model_manager.get_status()


@router.post("/models/load")
async def load_model(request: ModelLoadRequest):
    try:
        models = await get_models()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Ollama error: {exc}") from exc

    if request.model not in models:
        raise HTTPException(status_code=404, detail="Model not found")

    model_manager = get_model_manager()
    await model_manager.load_model(request.model)

    status = await model_manager.get_status()
    return {"loaded": request.model, "ram_free_gb": status.get("ram_free_gb")}


@router.post("/models/unload")
async def unload_model():
    model_manager = get_model_manager()
    unloaded = await model_manager.unload_current()

    if unloaded is None:
        return {"message": "nothing loaded"}

    return {"unloaded": unloaded}
