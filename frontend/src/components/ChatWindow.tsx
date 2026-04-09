import { DisplayMessage } from "@/lib/types";

import MessageBubble from "./MessageBubble";

type ChatWindowProps = {
  messages: DisplayMessage[];
  showTypingIndicator: boolean;
};

export default function ChatWindow({
  messages,
  showTypingIndicator,
}: ChatWindowProps) {
  return (
    <div className="mx-3 mt-4 flex-1 overflow-y-auto rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-5 sm:mx-4 sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
        {messages.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center text-slate-300/30">
            <p className="m-0 text-[0.85rem] text-slate-300/30">what do you want to know?</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
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
