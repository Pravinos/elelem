import { ChatMessage } from "@/lib/api";

type MessageBubbleProps = {
  message: ChatMessage;
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "border-blue-500/30 bg-blue-500/20 text-blue-100"
            : "border-slate-700 bg-slate-900/70 text-slate-100",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap">{message.content || " "}</p>
      </div>
    </div>
  );
}
