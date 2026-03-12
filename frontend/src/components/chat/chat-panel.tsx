import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Globe, BookOpen, Bot, X, PanelLeft, Plus, Bell } from "lucide-react";
import { ChatMessage } from "./chat-message";
import type { ChatMessage as ChatMessageType } from "@/hooks/use-chat";

interface Props {
  messages: ChatMessageType[];
  isStreaming: boolean;
  currentTool: string | null;
  onSend: (text: string) => void;
  onNewSession: () => void;
  onToggleSidebar: () => void;
  onClose?: () => void;
  sidebarOpen: boolean;
}

export function ChatPanel({
  messages,
  isStreaming,
  currentTool,
  onSend,
  onNewSession,
  onToggleSidebar,
  onClose,
  sidebarOpen,
}: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentTool]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        {!sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onToggleSidebar}
            title="Show conversations"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold">Charles</span>
          <p className="text-[11px] text-muted-foreground leading-tight">Portfolio assistant</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNewSession}
          title="New conversation"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:hidden" onClick={onClose} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="chat-scrollbar flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <Bot className="h-6 w-6" />
            </div>
            <p className="font-medium mb-1">Hi, I'm Charles</p>
            <p className="text-xs max-w-[240px]">
              Ask me anything about your portfolio. Try: "Why did SMGB drop?"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {currentTool && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {currentTool === "web_search" ? (
              <>
                <Globe className="h-3 w-3 animate-pulse" />
                <span>Searching the web...</span>
              </>
            ) : currentTool === "create_alert" ? (
              <>
                <Bell className="h-3 w-3 animate-pulse" />
                <span>Creating alert...</span>
              </>
            ) : (
              <>
                <BookOpen className="h-3 w-3 animate-pulse" />
                <span>Searching past reports...</span>
              </>
            )}
          </div>
        )}

        {isStreaming && !currentTool && (
          <div className="flex items-center gap-1 py-1">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Charles..."
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          disabled={isStreaming}
        />
        <Button type="submit" size="icon" className="h-9 w-9 rounded-full" disabled={isStreaming || !input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
