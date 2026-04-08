export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  };
}

export async function getModels(): Promise<string[]> {
  const response = await fetch(`${API_URL}/api/models`, {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load models (${response.status})`);
  }

  const data = (await response.json()) as { models?: string[] };
  return data.models ?? [];
}

export async function sendMessage(
  model: string,
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const fallback = `Chat request failed (${response.status})`;
    let detail = fallback;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? fallback;
    } catch {
      // Ignore parse errors and throw fallback message.
    }
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error("No response stream received from server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }

      let parsed: {
        message?: { content?: string };
        response?: string;
        error?: string;
      };

      try {
        parsed = JSON.parse(data) as {
          message?: { content?: string };
          response?: string;
          error?: string;
        };
      } catch {
        continue;
      }

      if (parsed.error) {
        throw new Error(parsed.error);
      }

      const token = parsed.message?.content ?? parsed.response ?? "";
      if (token) {
        onToken(token);
      }
    }
  }
}
