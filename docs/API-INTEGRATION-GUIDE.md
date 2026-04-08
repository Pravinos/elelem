# API Integration Guide

This guide is for developers who want to call the Ollama backend API directly from their own application.

It covers:

- Environment setup
- Authentication
- Model discovery
- Non-streaming chat
- Streaming chat (SSE)
- Error handling patterns
- Drop-in examples for JavaScript and Python

## 1. Prerequisites

Your server should be running these services:

- Ollama on the host machine (usually at http://localhost:11434)
- FastAPI backend from this repo

Default backend URL examples:

- Local network: http://192.168.x.x:8000
- Tailscale: http://100.x.x.x:8000
- Public phase: https://api.yourdomain.com

## 2. Authentication

All protected routes require:

- Header: X-API-Key

Example:

```http
X-API-Key: changeme
```

Public route:

- GET /api/health (no API key required)

Protected routes:

- GET /api/models
- POST /api/chat

## 3. Endpoint Reference

### GET /api/health

Use this to verify backend + Ollama connectivity.

Response:

```json
{
  "status": "ok",
  "ollama": true
}
```

### GET /api/models

Returns locally installed Ollama models.

Response:

```json
{
  "models": ["llama3.2:3b", "mistral:7b"]
}
```

### POST /api/chat

Request body:

```json
{
  "model": "llama3.2:3b",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true
}
```

Behavior:

- stream false: returns a single JSON response
- stream true: returns server-sent events where each event contains one Ollama NDJSON chunk

## 4. Quick Test With cURL

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
    "messages": [{"role": "user", "content": "Give me three title ideas"}],
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
    "messages": [{"role": "user", "content": "Write a short intro paragraph"}],
    "stream": true
  }'
```

## 5. JavaScript Example (Node or Browser)

This example streams tokens in real time.

```ts
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

async function streamChat(baseUrl: string, apiKey: string) {
  const model = "llama3.2:3b";
  const messages: ChatMessage[] = [
    { role: "user", content: "Explain vector databases in simple terms." }
  ];

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({ model, messages, stream: true })
  });

  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status})`;
    try {
      const payload = await res.json();
      detail = payload?.detail ?? detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const dataText = trimmed.slice(5).trim();
      if (!dataText) continue;

      const chunk = JSON.parse(dataText);
      if (chunk?.error) throw new Error(chunk.error);

      const token = chunk?.message?.content ?? chunk?.response ?? "";
      if (token) {
        fullText += token;
        process.stdout.write(token);
      }
    }
  }

  return fullText;
}
```

## 6. Python Example (Sync)

This example uses requests and handles SSE line-by-line.

```python
import json
import requests

BASE_URL = "http://localhost:8000"
API_KEY = "changeme"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
}

payload = {
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Summarize edge computing in 4 bullets."}],
    "stream": True,
}

with requests.post(f"{BASE_URL}/api/chat", headers=headers, json=payload, stream=True, timeout=120) as resp:
    resp.raise_for_status()

    full_text = ""
    for raw_line in resp.iter_lines(decode_unicode=True):
        if not raw_line:
            continue
        if not raw_line.startswith("data:"):
            continue

        data_text = raw_line[5:].strip()
        if not data_text:
            continue

        chunk = json.loads(data_text)
        if "error" in chunk:
            raise RuntimeError(chunk["error"])

        token = chunk.get("message", {}).get("content") or chunk.get("response", "")
        if token:
            full_text += token
            print(token, end="", flush=True)

print("\n\nDone")
```

## 7. Recommended Client Pattern

For a robust external client implementation:

1. Call GET /api/health before chat calls.
2. Call GET /api/models and cache model names.
3. Keep the selected model with full tag, for example llama3.2:3b.
4. For chat UI, use stream true and append tokens as they arrive.
5. For background tasks or webhooks, use stream false.
6. Treat 401 as invalid key and 502 as backend-to-Ollama failure.

## 8. Common Errors and Fixes

401 Invalid or missing API key:

- Ensure X-API-Key matches API_KEY from server .env.

502 Ollama connection error:

- Ensure Ollama is running with ollama serve.
- Verify OLLAMA_BASE_URL in backend env.

No models returned:

- Run ollama pull <model_name> first, then call GET /api/models again.

CORS issue from browser app:

- Set ALLOWED_ORIGINS to include your frontend origin in production mode.

## 9. Production Notes

When moving from Tailscale/private access to public access:

1. Change client base URL to your public API domain.
2. Update ALLOWED_ORIGINS on the backend.
3. Keep API contracts unchanged.

No client code changes are required if your app already uses the same endpoint paths and headers.
