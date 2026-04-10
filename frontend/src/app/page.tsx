"use client";

import ChatWindow from "@/components/ChatWindow";
import ModelSelector from "@/components/ModelSelector";
import { formatRelativeTime, useChatController } from "@/hooks/useChatController";

export default function HomePage() {
  const {
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
  } = useChatController();

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        void handleSend();
      }
    }
  }

  return (
    <main className="relative mx-auto flex h-screen w-full max-w-7xl gap-0 px-0 py-0 text-slate-100/85 sm:px-0 sm:py-0">
      <button
        type="button"
        aria-label="Close chat history"
        onClick={() => setSidebarOpen(false)}
        className={[
          "absolute inset-0 z-20 bg-black/40 transition-opacity duration-200 md:hidden",
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <aside
        className={[
          "absolute left-3 top-3 z-30 flex h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-[14px] bg-slate-950/95 transition-all duration-200 ease-out md:static md:my-3 md:ml-3 md:mr-0 md:h-[calc(100%-1.5rem)] md:bg-white/[0.025]",
          sidebarOpen
            ? "w-[240px] translate-x-0 border border-white/[0.08] p-3 opacity-100"
            : "w-0 -translate-x-2 border border-transparent p-0 opacity-0 pointer-events-none",
        ].join(" ")}
      >
          <p className="pb-2 pt-4 text-left text-[0.7rem] uppercase tracking-[0.1em] text-slate-300/30">chats</p>

          <button
            type="button"
            onClick={handleNewChat}
            className="mb-3 inline-flex w-full items-center justify-center rounded-lg border border-teal-300/60 bg-teal-400 px-3.5 py-[9px] text-[0.85rem] font-medium text-slate-950 transition-all hover:border-teal-200 hover:bg-teal-300"
          >
            <span>New chat</span>
          </button>

          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {historyChats.length === 0 ? (
              <div className="px-4 py-6 text-center text-[0.8rem] text-slate-300/25">
                No saved chats yet.
              </div>
            ) : (
              historyChats.map((chat) => {
                const isActive = activeChatId === chat.id;
                const awaitingConfirm = pendingDeleteId === chat.id;

                return (
                  <div
                    key={chat.id}
                    className={[
                      "group relative cursor-pointer rounded-lg border border-transparent bg-transparent transition",
                      isActive
                        ? "border-blue-400/35 bg-blue-500/[0.14]"
                        : "hover:border-blue-300/[0.2] hover:bg-blue-500/[0.08]",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectChat(chat.id)}
                      className="w-full rounded-xl p-3 pr-8 text-left"
                    >
                      <div>
                        <p
                          className={[
                            "truncate text-sm font-medium",
                            isActive ? "text-slate-100" : "text-slate-200",
                          ].join(" ")}
                        >
                          {chat.title}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {isActive ? <span className="h-4 w-0.5 rounded-full bg-teal-400" /> : null}
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-300/70">
                          {chat.model}
                        </span>
                      </div>
                      <div className="mt-2 text-left">
                        <span className="text-[11px] text-slate-400/45">
                          {formatRelativeTime(chat.updated_at)}
                        </span>
                      </div>
                    </button>

                    <div data-delete-control="true" className="absolute right-2 top-2 inline-block">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                        className={[
                          "rounded px-1.5 py-0.5 text-sm transition",
                          awaitingConfirm
                            ? "bg-rose-500/20 text-rose-300 opacity-100"
                            : "text-slate-500 opacity-0 hover:bg-slate-800 hover:text-rose-300 group-hover:opacity-100",
                        ].join(" ")}
                        aria-label="Delete chat"
                      >
                        x
                      </button>

                      {awaitingConfirm ? (
                        <span className="absolute right-[calc(100%+8px)] top-1/2 z-50 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.12] bg-[rgba(20,20,28,0.95)] px-2.5 py-1.5 text-xs text-white/70">
                          <span>delete?</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleConfirmDeleteChat(chat.id);
                            }}
                            className="font-medium text-[#ff6b6b] transition hover:text-[#ff4444]"
                          >
                            yes
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
      </aside>

      <section className="my-3 ml-3 mr-3 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.02]">
        <header className="rounded-t-[12px] border-b border-white/[0.07] bg-white/[0.015] px-5 py-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <button
              type="button"
              aria-label="Toggle chat history"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="justify-self-start flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] transition-all hover:border-white/20 hover:bg-white/[0.08]"
            >
              <span className="block h-[1.5px] w-4 rounded bg-white/60" />
              <span className="block h-[1.5px] w-4 rounded bg-white/60" />
              <span className="block h-[1.5px] w-4 rounded bg-white/60" />
            </button>

            <h1 className="justify-self-center text-center text-lg font-semibold tracking-tight text-slate-100/85">
              elelem
            </h1>

            <div className="justify-self-end">
              <ModelSelector
                compact
                models={models}
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={loading}
              />
            </div>
          </div>
        </header>

        <ChatWindow messages={messages} showTypingIndicator={awaitingFirstToken} />

        <div className="border-t border-white/[0.07] bg-white/[0.01] px-4 py-3 sm:px-5">
          <form
            onSubmit={handleSubmit}
            className="rounded-[24px] border border-blue-300/[0.25] bg-blue-500/[0.08] px-4 py-3 transition-colors focus-within:border-blue-300/[0.45] focus-within:bg-blue-500/[0.12]"
          >
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={1}
                placeholder={selectedModel ? "Ask anything..." : "Load models first..."}
                className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                disabled={loading || !selectedModel}
              />

              {loading ? (
                <button
                  type="button"
                  onClick={() => void handleStop()}
                  className="inline-flex h-8 min-w-[64px] items-center justify-center rounded-full bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-500"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send message"
                  className="h-8 w-8 rounded-full bg-blue-500/70 text-sm text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700/70 disabled:text-slate-300/50"
                >
                  &gt;
                </button>
              )}
            </div>
          </form>
        </div>

        {error ? (
          <div className="fixed bottom-6 left-6 z-[100] flex max-w-[280px] items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-600/15 px-3 py-2 text-[0.8rem] text-slate-100/70 backdrop-blur-sm">
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-0 text-base leading-none opacity-60 transition hover:opacity-100"
              aria-label="Dismiss error"
            >
              x
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
