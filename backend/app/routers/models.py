from fastapi import APIRouter, HTTPException
import httpx

from app.services.ollama import get_models


router = APIRouter()


@router.get("/models")
async def list_models():
    try:
        models = await get_models()
        return {"models": models}
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Ollama error: {exc}") from exc
