import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { User, Bot } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/hooks/use-chat";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary" : "bg-muted"
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-primary-foreground" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="chat-prose break-words">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.tools_used && message.tools_used.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.tools_used.map((t, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                {t.tool === "web_search" ? "Web Search" : "Report History"}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
