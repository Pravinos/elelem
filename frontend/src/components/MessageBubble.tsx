import { ChatMessage } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content || " "}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ children, ...props }) {
                return (
                  <code
                    className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em]"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              pre({ children }) {
                return (
                  <pre className="mb-2 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[0.9em]">
                    {children}
                  </pre>
                );
              },
              p({ children }) {
                return <p className="mb-2 last:mb-0">{children}</p>;
              },
              ul({ children }) {
                return <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>;
              },
              h3({ children }) {
                return <h3 className="mb-1 mt-3 text-base font-semibold first:mt-0">{children}</h3>;
              },
            }}
          >
            {message.content || " "}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
