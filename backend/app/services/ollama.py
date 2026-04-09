import json

import httpx

from app.core.config import settings


OLLAMA_BASE_URL = settings.OLLAMA_BASE_URL


async def check_ollama_health() -> bool:
    url = f"{OLLAMA_BASE_URL}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            response.raise_for_status()
        return True
    except httpx.HTTPError:
        return False


async def get_models() -> list[str]:
    url = f"{OLLAMA_BASE_URL}/api/tags"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()

    models = payload.get("models", [])
    return [model.get("name") for model in models if model.get("name")]


async def chat_once(payload: dict) -> dict:
    url = f"{OLLAMA_BASE_URL}/api/chat"
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


async def stream_chat_lines(payload: dict):
    url = f"{OLLAMA_BASE_URL}/api/chat"
    timeout = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=30.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue

                # Validate NDJSON chunks before forwarding them as SSE data events.
                try:
                    json.loads(line)
                except json.JSONDecodeError:
                    continue

                yield line
