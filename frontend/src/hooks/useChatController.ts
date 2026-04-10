import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
import { DisplayMessage } from "@/lib/types";

const MAX_CONTEXT_MESSAGES = 20;

function sortChats(chats: HistoryChatSummary[]) {
  return [...chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
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

function toApiMessage(message: DisplayMessage): ChatMessage {
  return {
    role: message.role,
    content: message.content,
  };
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createMessage(role: ChatMessage["role"], content: string): DisplayMessage {
  return {
    id: createMessageId(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function buildModelContext(messages: DisplayMessage[], nextUserMessage: DisplayMessage): ChatMessage[] {
  const context = [...messages, nextUserMessage];
  return context.slice(-MAX_CONTEXT_MESSAGES).map(toApiMessage);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function formatRelativeTime(isoDate: string) {
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

export function useChatController() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [historyChats, setHistoryChats] = useState<HistoryChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchedInitialRef = useRef(false);
  const activeReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const stopRequestedRef = useRef(false);
  const unsavedTurnsRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    if (fetchedInitialRef.current) {
      return;
    }

    fetchedInitialRef.current = true;
    (async () => {
      try {
        setError(null);
        const [availableModels, chatHistory] = await Promise.all([getModels(), getHistoryChats()]);
        setModels(availableModels);
        setHistoryChats(sortChats(chatHistory));
        if (availableModels.length > 0) {
          setSelectedModel(availableModels[0]);
        }
      } catch (err) {
        setError(errorMessage(err, "Failed to load initial data"));
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

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest("[data-delete-control='true']")) {
        setPendingDeleteId(null);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeout = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const canSend = useMemo(() => {
    return Boolean(input.trim()) && Boolean(selectedModel) && !loading;
  }, [input, selectedModel, loading]);

  function upsertHistory(chat: HistoryChatSummary) {
    setHistoryChats((prev) => sortChats([chat, ...prev.filter((item) => item.id !== chat.id)]));
  }

  function handleNewChat() {
    if (loading) {
      return;
    }

    unsavedTurnsRef.current = [];
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setPendingDeleteId(null);
  }

  async function handleSelectChat(chatId: string) {
    if (loading) {
      return;
    }

    try {
      setError(null);
      setPendingDeleteId(null);
      const chat = await getHistoryChat(chatId);
      unsavedTurnsRef.current = [];
      setActiveChatId(chat.id);
      setSelectedModel(chat.model);
      setMessages(
        chat.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
        })),
      );
      if (window.matchMedia("(max-width: 768px)").matches) {
        setSidebarOpen(false);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to load chat"));
    }
  }

  function handleDeleteChat(chatId: string) {
    if (loading) {
      return;
    }

    setPendingDeleteId(chatId);
  }

  async function handleConfirmDeleteChat(chatId: string) {
    if (loading) {
      return;
    }

    if (pendingDeleteId !== chatId) {
      return;
    }

    setPendingDeleteId(null);
    const removed = historyChats.find((chat) => chat.id === chatId);
    const wasActive = activeChatId === chatId;
    const previousMessages = messages;
    const previousInput = input;
    const previousActiveChatId = activeChatId;

    setHistoryChats((prev) => prev.filter((chat) => chat.id !== chatId));
    if (wasActive) {
      handleNewChat();
    }

    try {
      setError(null);
      await deleteHistoryChat(chatId);
    } catch (err) {
      if (removed) {
        setHistoryChats((prev) => sortChats([removed, ...prev]));
      }
      if (wasActive) {
        setActiveChatId(previousActiveChatId);
        setMessages(previousMessages);
        setInput(previousInput);
      }
      setError(errorMessage(err, "Failed to delete chat"));
    }
  }

  async function handleStop() {
    if (!loading) {
      return;
    }

    stopRequestedRef.current = true;
    setAwaitingFirstToken(false);

    try {
      await activeReaderRef.current?.cancel();
    } catch {
      // Ignore cancellation errors during explicit stop.
    }
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || !selectedModel || loading) {
      return;
    }

    const userMessage = createMessage("user", content);
    const assistantMessage = createMessage("assistant", "");
    const historyWithUser = buildModelContext(messages, userMessage);

    setInput("");
    setError(null);
    setLoading(true);
    setAwaitingFirstToken(true);
    stopRequestedRef.current = false;
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    let historyChatId = activeChatId;
    let assistantContent = "";
    let streamFailed = false;

    try {
      await sendMessage(
        selectedModel,
        historyWithUser,
        (token) => {
          assistantContent += token;
          setAwaitingFirstToken(false);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: `${message.content}${token}` }
                : message,
            ),
          );
        },
        (reader) => {
          activeReaderRef.current = reader;
        },
      );
    } catch (err) {
      if (!stopRequestedRef.current) {
        streamFailed = true;
        setError(errorMessage(err, "Request failed"));
        setMessages((prev) =>
          prev.map((messageEntry) =>
            messageEntry.id === assistantMessage.id && !messageEntry.content
              ? {
                  ...messageEntry,
                  content: "I could not generate a response. Please try again.",
                }
              : messageEntry,
          ),
        );
      }
    } finally {
      const stopped = stopRequestedRef.current;

      if (!streamFailed || stopped) {
        const assistantPayload: ChatMessage[] = assistantContent
          ? [{ role: "assistant", content: assistantContent }]
          : [];
        const turnPayload: ChatMessage[] = [{ role: "user", content }, ...assistantPayload];

        if (historyChatId) {
          try {
            const updated = await appendHistoryMessages(historyChatId, turnPayload);
            upsertHistory(toSummary(updated));
          } catch (historyErr) {
            setError(errorMessage(historyErr, "Failed to update chat history"));
          }
        } else {
          unsavedTurnsRef.current = [...unsavedTurnsRef.current, ...turnPayload];

          try {
            const created = await createHistoryChat(selectedModel, unsavedTurnsRef.current);
            historyChatId = created.id;
            unsavedTurnsRef.current = [];
            setActiveChatId(created.id);
            upsertHistory(created);
          } catch (historyErr) {
            setError(errorMessage(historyErr, "Failed to create chat history"));
          }
        }
      }

      activeReaderRef.current = null;
      stopRequestedRef.current = false;
      setAwaitingFirstToken(false);
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void handleSend();
  }

  return {
    models,
    selectedModel,
    setSelectedModel,
    messages,
    historyChats,
    activeChatId,
    sidebarOpen,
    setSidebarOpen,
    pendingDeleteId,
    input,
    setInput,
    loading,
    awaitingFirstToken,
    error,
    setError,
    canSend,
    handleNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleConfirmDeleteChat,
    handleStop,
    handleSend,
    handleSubmit,
  };
}
