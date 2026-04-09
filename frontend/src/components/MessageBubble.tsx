import { DisplayMessage } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MessageBubbleProps = {
  message: DisplayMessage;
};

function formatMessageTime(isoDate: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={[
        "group flex [animation:message-fade-in_200ms_ease-out]",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      {isUser ? (
        <div className="max-w-[78%] text-right">
          <div className="text-sm leading-relaxed text-slate-100">
            <p className="whitespace-pre-wrap">{message.content || " "}</p>
          </div>
          <p className="mt-1 text-right text-[11px] text-slate-500 opacity-0 transition group-hover:opacity-100">
            {formatMessageTime(message.createdAt)}
          </p>
        </div>
      ) : (
        <div className="flex max-w-[88%] items-start gap-3 py-0.5">
          <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-white/10 text-center text-[11px] font-semibold leading-[22px] text-slate-300/80">
            e
          </div>
          <div className="min-w-0 border-l border-white/10 pl-3 text-sm leading-[1.7] text-slate-100/90">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ children, ...props }) {
                  return (
                    <code
                      className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.9em]"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
                  return (
                    <pre className="mb-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-[0.9em]">
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
            <p className="mt-1 text-[11px] text-slate-500 opacity-0 transition group-hover:opacity-100">
              {formatMessageTime(message.createdAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
