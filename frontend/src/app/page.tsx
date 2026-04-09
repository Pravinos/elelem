"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import ChatWindow from "@/components/ChatWindow";
import ModelSelector from "@/components/ModelSelector";
import {
  appendHistoryMessages,
  ChatMessage,
  createHistoryChat,
  deleteHistoryChat,
  getHistoryChat,
  getHistoryChats,
  getModels,
  HistoryChat,
  HistoryChatSummary,
  sendMessage,
} from "@/lib/api";

function sortChats(chats: HistoryChatSummary[]) {
  return [...chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function formatRelativeTime(isoDate: string) {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const deltaSeconds = Math.round((then - now) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absoluteSeconds < 60) {
    return rtf.format(deltaSeconds, "second");
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (Math.abs(deltaMinutes) < 60) {
    return rtf.format(deltaMinutes, "minute");
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return rtf.format(deltaHours, "hour");
  }

  const deltaDays = Math.round(deltaHours / 24);
  return rtf.format(deltaDays, "day");
}

function toSummary(chat: HistoryChat): HistoryChatSummary {
  return {
    id: chat.id,
    title: chat.title,
    model: chat.model,
    created_at: chat.created_at,
    updated_at: chat.updated_at,
  };
}

export default function HomePage() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyChats, setHistoryChats] = useState<HistoryChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedInitialRef = useRef(false);

  useEffect(() => {
    if (fetchedInitialRef.current) {
      return;
    }

    fetchedInitialRef.current = true;
    (async () => {
      try {
        setError(null);
        const [availableModels, chatHistory] = await Promise.all([
          getModels(),
          getHistoryChats(),
        ]);
        setModels(availableModels);
        setHistoryChats(sortChats(chatHistory));
        if (availableModels.length > 0) {
          setSelectedModel(availableModels[0]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load initial data";
        setError(message);
      }
    })();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const syncSidebarState = () => {
      setSidebarOpen(!mediaQuery.matches);
    };

    syncSidebarState();
    mediaQuery.addEventListener("change", syncSidebarState);
    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  const canSend = useMemo(() => {
    return Boolean(input.trim()) && Boolean(selectedModel) && !loading;
  }, [input, selectedModel, loading]);

  function upsertHistory(chat: HistoryChatSummary) {
    setHistoryChats((prev) => sortChats([chat, ...prev.filter((item) => item.id !== chat.id)]));
  }

  function handleNewChat() {
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setError(null);
  }

  async function handleSelectChat(chatId: string) {
    try {
      setError(null);
      const chat = await getHistoryChat(chatId);
      setActiveChatId(chat.id);
      setSelectedModel(chat.model);
      setMessages(chat.messages.map((message) => ({ role: message.role, content: message.content })));
      if (window.matchMedia("(max-width: 768px)").matches) {
        setSidebarOpen(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load chat";
      setError(message);
    }
  }

  async function handleDeleteChat(chatId: string) {
    try {
      setError(null);
      await deleteHistoryChat(chatId);
      setHistoryChats((prev) => prev.filter((chat) => chat.id !== chatId));
      if (activeChatId === chatId) {
        handleNewChat();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete chat";
      setError(message);
    }
  }

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

    const currentChatId = activeChatId;
    let historyChatId = currentChatId;
    const createdThisTurn = !currentChatId;
    let assistantContent = "";

    if (!historyChatId) {
      try {
        const created = await createHistoryChat(selectedModel, [userMessage]);
        historyChatId = created.id;
        setActiveChatId(created.id);
        upsertHistory(created);
      } catch (historyErr) {
        const historyMessage =
          historyErr instanceof Error ? historyErr.message : "Failed to create chat history";
        setError(historyMessage);
      }
    }

    try {
      await sendMessage(selectedModel, historyWithUser, (token) => {
        assistantContent += token;
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

      if (historyChatId && assistantContent.trim()) {
        const payload: ChatMessage[] = createdThisTurn
          ? [{ role: "assistant", content: assistantContent }]
          : [userMessage, { role: "assistant", content: assistantContent }];
        const updated = await appendHistoryMessages(historyChatId, payload);
        upsertHistory(toSummary(updated));
      }
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
    <main className="relative mx-auto flex h-screen w-full max-w-6xl overflow-hidden px-3 py-4 sm:px-6 sm:py-6">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close chat history"
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 z-20 bg-black/40 md:hidden"
        />
      ) : null}

      {sidebarOpen ? (
        <aside className="absolute left-3 top-4 z-30 flex h-[calc(100%-2rem)] w-[260px] flex-col rounded-2xl border-r border-slate-800/80 border border-slate-800/80 bg-slate-950/95 p-3 shadow-xl shadow-black/30 md:static md:mr-4 md:h-full md:rounded-2xl md:bg-slate-950/70">
          <button
            type="button"
            onClick={handleNewChat}
            className="mb-3 rounded-xl bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
          >
            New chat
          </button>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {historyChats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400">
                No saved chats yet.
              </div>
            ) : (
              historyChats.map((chat) => {
                const isActive = activeChatId === chat.id;
                return (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => handleSelectChat(chat.id)}
                    className={[
                      "group w-full rounded-xl border p-3 text-left transition",
                      isActive
                        ? "border-teal-400/70 bg-teal-500/10"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{chat.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <span className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-300">
                            {chat.model}
                          </span>
                          <span>{formatRelativeTime(chat.updated_at)}</span>
                        </div>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteChat(chat.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleDeleteChat(chat.id);
                          }
                        }}
                        className="shrink-0 rounded px-1 text-slate-500 opacity-0 transition hover:bg-slate-800 hover:text-rose-300 group-hover:opacity-100"
                        aria-label="Delete chat"
                      >
                        ×
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="rounded-2xl border border-slate-800/80 bg-slate-950/55 p-4 shadow-xl shadow-black/20">
          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-label="Toggle chat history"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="mt-0.5 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200 transition hover:border-slate-600"
            >
              ☰
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 sm:text-xl">elelem</h1>
              <p className="mt-1 text-sm text-slate-400">your local ai, your hardware, your rules.</p>
            </div>
          </div>
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
      </section>
    </main>
  );
}
