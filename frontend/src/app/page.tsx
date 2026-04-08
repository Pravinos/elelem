"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import ChatWindow from "@/components/ChatWindow";
import ModelSelector from "@/components/ModelSelector";
import { ChatMessage, getModels, sendMessage } from "@/lib/api";

export default function HomePage() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedModelsRef = useRef(false);

  useEffect(() => {
    if (fetchedModelsRef.current) {
      return;
    }

    fetchedModelsRef.current = true;
    (async () => {
      try {
        setError(null);
        const availableModels = await getModels();
        setModels(availableModels);
        if (availableModels.length > 0) {
          setSelectedModel(availableModels[0]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load models";
        setError(message);
      }
    })();
  }, []);

  const canSend = useMemo(() => {
    return Boolean(input.trim()) && Boolean(selectedModel) && !loading;
  }, [input, selectedModel, loading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const content = input.trim();
    if (!content || !selectedModel || loading) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content };
    const historyWithUser = [...messages, userMessage];

    setInput("");
    setError(null);
    setLoading(true);
    setAwaitingFirstToken(true);
    setMessages([...historyWithUser, { role: "assistant", content: "" }]);

    try {
      await sendMessage(selectedModel, historyWithUser, (token) => {
        setAwaitingFirstToken(false);
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (lastIndex >= 0 && next[lastIndex].role === "assistant") {
            next[lastIndex] = {
              ...next[lastIndex],
              content: `${next[lastIndex].content}${token}`,
            };
          }
          return next;
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      setMessages((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        if (lastIndex >= 0 && next[lastIndex].role === "assistant" && !next[lastIndex].content) {
          next[lastIndex] = {
            role: "assistant",
            content: "I could not generate a response. Please try again.",
          };
        }
        return next;
      });
    } finally {
      setAwaitingFirstToken(false);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="rounded-2xl border border-slate-800/80 bg-slate-950/55 p-4 shadow-xl shadow-black/20">
        <h1 className="text-lg font-semibold text-slate-100 sm:text-xl">Ollama Chat</h1>
        <p className="mt-1 text-sm text-slate-400">Self-hosted AI chat over your private network.</p>
        <div className="mt-4 max-w-sm">
          <ModelSelector
            models={models}
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={loading}
          />
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <ChatWindow messages={messages} showTypingIndicator={awaitingFirstToken} />

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 shadow-xl shadow-black/20"
      >
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={2}
            placeholder={selectedModel ? "Ask something..." : "Load models first..."}
            className="min-h-[52px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400"
            disabled={loading || !selectedModel}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </main>
  );
}
