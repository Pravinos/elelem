# elelem 🖥️

A self-hosted LLM chat app running on your own hardware.
No cloud APIs, no token costs, no data leaving your network.

Built with FastAPI + Ollama on the backend and Next.js on the frontend,
deployed as a monorepo on a Debian home server accessible over Tailscale.

---

## Stack

- **Backend** — FastAPI, Python 3.11, httpx, Pydantic
- **Frontend** — Next.js 14 (app router), TypeScript, Tailwind CSS
- **LLM runtime** — Ollama (runs native on host, not in Docker)
- **Models** — `llama3.2:3b`, `qwen2.5:3b` (more can be pulled anytime)
- **Network** — Tailscale for private access, Cloudflare Tunnel for phase 2

---

## Project Structure
```text
elelem/
├── backend/             # FastAPI app
│   └── app/
│       ├── routers/     # chat, models endpoints
│       ├── services/    # ollama client, model manager, idle watcher
│       ├── middleware/  # API key auth
│       └── schemas/     # Pydantic models
├── frontend/            # Next.js app
│   └── src/
│       ├── app/         # pages
│       ├── components/  # ChatWindow, MessageBubble, ModelSelector
│       └── lib/         # typed API client
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── docs/
  └── API-INTEGRATION-GUIDE.md
```

---

## Setup

### Prerequisites

- Docker + Docker Compose
- Ollama installed on the host machine
- Tailscale (for private network access)

### 1. Install and configure Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Configure for limited RAM (important on 8GB machines)
sudo systemctl edit ollama
```

Add:
```ini
[Service]
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_FLASH_ATTENTION=1"
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama

# Pull models
ollama pull llama3.2:3b
ollama pull qwen2.5:3b
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env
```

```env
ENVIRONMENT=development

# Backend
OLLAMA_BASE_URL=http://localhost:11434
API_KEY=your_secret_key
ALLOWED_ORIGINS=http://localhost:3000,http://<tailscale-ip>:3000
IDLE_TIMEOUT_MINUTES=5

# Frontend
NEXT_PUBLIC_API_URL=http://<tailscale-ip>:8000
NEXT_PUBLIC_API_KEY=your_secret_key   # must match API_KEY
```

Get your Tailscale IP with `tailscale ip -4`.

### 3. Start

```bash
docker compose up -d --build
docker compose ps       # both containers should show running
```

If you change `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_KEY`, rebuild the frontend so the new values are baked into the Next.js build:

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

Access at `http://<tailscale-ip>:3000` from any device on your Tailscale network.

---

## Model memory management

Ollama keeps models loaded in RAM indefinitely by default.
On a memory-constrained machine that's a problem — so elelem manages
the model lifecycle explicitly.

- **Load on demand** — model is loaded when a chat request comes in
- **One model at a time** — switching models unloads the previous one first
- **Idle unload** — model is evicted after `IDLE_TIMEOUT_MINUTES` of inactivity
- **Clean shutdown** — model is unloaded when the container stops

This keeps RAM free when you're not actively chatting.

---

## External API access

Other apps can call the backend directly — elelem works as a private LLM API.

| Phase | Base URL |
|---|---|
| Local | `http://localhost:8000` |
| Tailscale | `http://<tailscale-ip>:8000` |
| Phase 2 (public) | `https://api.yourdomain.com` |

All protected endpoints require:

```http
X-API-Key: <your_api_key>
```

---

## API reference

### `GET /api/health`
No auth required.
```json
{ "status": "ok", "ollama": true }
```

### `GET /api/models`
Returns locally available Ollama models.
```json
{ "models": ["llama3.2:3b", "qwen2.5:3b"] }
```

### `GET /api/models/status`
Returns currently loaded model and memory usage.
```json
{
  "current_model": "llama3.2:3b",
  "last_used": "2025-01-01T12:00:00",
  "idle_seconds": 42,
  "memory_used_gb": 2.1,
  "ram_free_gb": 4.2
}
```

### `POST /api/models/load`
Manually preload a model into memory.
```json
{ "model": "qwen2.5:3b" }
```

### `POST /api/models/unload`
Immediately evict the current model from memory.

### `POST /api/chat`
```json
{
  "model": "llama3.2:3b",
  "messages": [
    { "role": "user", "content": "explain docker networking" }
  ],
  "stream": true
}
```

`stream: false` — returns full response JSON.
`stream: true` — returns `text/event-stream`, tokens arrive as SSE events.

---

## Streaming (SSE)

When `stream: true`, parse the response like this:

```ts
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
    if (!line.trim().startsWith("data:")) continue;
    const json = line.trim().slice(5).trim();
    if (!json) continue;
    const chunk = JSON.parse(json);
    const token = chunk?.message?.content ?? chunk?.response ?? "";
    if (token) process.stdout.write(token);
  }
}
```

---

## Interactive docs

FastAPI auto-generates docs at `/docs` — useful for testing endpoints
directly without writing curl commands. Auth middleware is intentionally
skipped for `/docs`.

---

## Phase 2 — going public

When you're ready to expose elelem to the internet:

1. Buy a domain (Cloudflare Registrar is cheapest, ~$10/yr)
2. Install `cloudflared` on the server
3. Create a tunnel — no open ports, no router config needed
4. Update two env vars:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

5. Switch to `docker-compose.prod.yml`

No code changes required.
