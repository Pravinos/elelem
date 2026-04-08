# Ollama Self-Hosted AI App

This monorepo provides a self-hosted chat app with:

- FastAPI backend in `backend/`
- Next.js frontend in `frontend/`

## Integration Guide

For a full step-by-step external API guide, see:

- [docs/API-INTEGRATION-GUIDE.md](docs/API-INTEGRATION-GUIDE.md)

## External API Access

Yes. External applications can call the backend API directly.

Base URL examples:

- Local network: `http://<server-ip>:8000`
- Tailscale: `http://100.x.x.x:8000`
- Phase 2 public: `https://api.yourdomain.com`

All protected endpoints require this header:

- `X-API-Key: <your_api_key>`

The API key is configured by `API_KEY` in the root `.env` file.

## API Endpoints

### Health

- Method: `GET`
- Path: `/api/health`
- Auth required: No

Response:

```json
{
  "status": "ok",
  "ollama": true
}
```

### Models

- Method: `GET`
- Path: `/api/models`
- Auth required: Yes (`X-API-Key`)

Response:

```json
{
  "models": ["llama3.2:3b", "mistral:7b"]
}
```

### Chat

- Method: `POST`
- Path: `/api/chat`
- Auth required: Yes (`X-API-Key`)

Request body:

```json
{
  "model": "llama3.2:3b",
  "messages": [
    {"role": "user", "content": "Write a haiku about home servers."}
  ],
  "stream": true
}
```

Behavior:

- `stream: false` returns the full Ollama chat response JSON.
- `stream: true` returns `text/event-stream` and forwards chunks as SSE events.

## Streaming Format (SSE)

When `stream: true`, each event is returned as an SSE line:

```text
data: { ...ollama_ndjson_chunk... }

```

Your client should:

1. Read the HTTP response stream.
2. Parse lines starting with `data:`.
3. Parse JSON payload from each `data:` line.
4. Append token content from `message.content` (or `response` fallback).

## Example: cURL

### Health

```bash
curl http://localhost:8000/api/health
```

### Models

```bash
curl -H "X-API-Key: changeme" \
  http://localhost:8000/api/models
```

### Chat (non-streaming)

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: changeme" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

### Chat (streaming)

```bash
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: changeme" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Tell me a joke"}],
    "stream": true
  }'
```

## Example: JavaScript (External App)

```ts
async function streamChat() {
  const res = await fetch("http://localhost:8000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "changeme"
    },
    body: JSON.stringify({
      model: "llama3.2:3b",
      messages: [{ role: "user", content: "Summarize this text" }],
      stream: true
    })
  });

  if (!res.ok || !res.body) {
    throw new Error(`Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const jsonText = trimmed.slice(5).trim();
      if (!jsonText) continue;

      const chunk = JSON.parse(jsonText);
      const token = chunk?.message?.content ?? chunk?.response ?? "";
      if (token) {
        process.stdout.write(token);
      }
    }
  }
}
```

## OpenAPI Docs

FastAPI also exposes interactive docs at:

- `/docs`
- `/openapi.json`

Note: in this project, `/docs` is intentionally excluded from API key middleware.
