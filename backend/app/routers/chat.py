import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from app.schemas.chat import ChatRequest
from app.services.model_manager import get_model_manager
from app.services.ollama import chat_once, stream_chat_lines


router = APIRouter()


@router.post("/chat")
async def chat(request: ChatRequest):
    payload = request.model_dump()
    manager = get_model_manager()

    await manager.load_model(request.model)

    try:
        if not request.stream:
            response = await chat_once(payload)
            manager.last_used = datetime.now(timezone.utc)
            return response

        async def sse_stream():
            try:
                async for line in stream_chat_lines(payload):
                    yield f"data: {line}\n\n"
            except httpx.HTTPStatusError as exc:
                err = {"error": f"Ollama HTTP error: {exc}"}
                yield f"data: {json.dumps(err)}\n\n"
            except httpx.HTTPError as exc:
                err = {"error": f"Ollama connection error: {exc}"}
                yield f"data: {json.dumps(err)}\n\n"
            finally:
                manager.last_used = datetime.now(timezone.utc)

        return StreamingResponse(sse_stream(), media_type="text/event-stream")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Ollama HTTP error: {exc}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Ollama connection error: {exc}") from exc
