import { ChatMessage } from "@/lib/api";

import MessageBubble from "./MessageBubble";

type ChatWindowProps = {
  messages: ChatMessage[];
  showTypingIndicator: boolean;
};

export default function ChatWindow({
  messages,
  showTypingIndicator,
}: ChatWindowProps) {
  return (
    <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
            Start by choosing a model and sending a message.
          </div>
        ) : (
          messages.map((message, idx) => (
            <MessageBubble key={`${idx}-${message.role}`} message={message} />
          ))
        )}

        {showTypingIndicator ? (
          <div className="text-sm text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-teal-400" />
              Assistant is typing
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
