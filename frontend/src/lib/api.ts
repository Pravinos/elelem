export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type HistoryChatSummary = {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
};

export type HistoryMessage = {
  id: string;
  role: ChatMessage["role"];
  content: string;
  created_at: string;
};

export type HistoryChat = {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
  messages: HistoryMessage[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  };
}

async function readError(response: Response, fallback: string): Promise<never> {
  let detail = fallback;
  try {
    const payload = (await response.json()) as { detail?: string };
    detail = payload.detail ?? fallback;
  } catch {
    // Ignore parse errors and throw fallback message.
  }
  throw new Error(detail);
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
  onReader?: (reader: ReadableStreamDefaultReader<Uint8Array>) => void,
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
    await readError(response, fallback);
  }

  if (!response.body) {
    throw new Error("No response stream received from server");
  }

  const reader = response.body.getReader();
  onReader?.(reader);
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

export async function getHistoryChats(): Promise<HistoryChatSummary[]> {
  const response = await fetch(`${API_URL}/api/history`, {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    await readError(response, `Failed to load history (${response.status})`);
  }

  return (await response.json()) as HistoryChatSummary[];
}

export async function createHistoryChat(
  model: string,
  messages: ChatMessage[],
): Promise<HistoryChatSummary> {
  const response = await fetch(`${API_URL}/api/history`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    await readError(response, `Failed to create chat (${response.status})`);
  }

  return (await response.json()) as HistoryChatSummary;
}

export async function getHistoryChat(chatId: string): Promise<HistoryChat> {
  const response = await fetch(`${API_URL}/api/history/${chatId}`, {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    await readError(response, `Failed to load chat (${response.status})`);
  }

  return (await response.json()) as HistoryChat;
}

export async function appendHistoryMessages(
  chatId: string,
  messages: ChatMessage[],
): Promise<HistoryChat> {
  const response = await fetch(`${API_URL}/api/history/${chatId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    await readError(response, `Failed to update chat (${response.status})`);
  }

  return (await response.json()) as HistoryChat;
}

export async function deleteHistoryChat(chatId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/history/${chatId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    await readError(response, `Failed to delete chat (${response.status})`);
  }
}
