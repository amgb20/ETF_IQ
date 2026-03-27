import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send, Globe, BookOpen, Bell, Plus, Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";
import { ExpandedSources, collectSources } from "./source-chips";
import type { ChatMessage as ChatMessageType, ChatSource } from "@/hooks/use-chat";

export type ChatTab = "answer" | "links";

/* ── Tool activity pill ── */
function ToolActivity({ tool }: { tool: string }) {
  const label =
    tool === "web_search" ? "Searching the web"
    : tool === "create_alert" ? "Creating alert"
    : "Searching reports";

  const Icon =
    tool === "web_search" ? Globe
    : tool === "create_alert" ? Bell
    : BookOpen;

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex items-center gap-1.5 text-xs text-primary">
        <Icon className="h-3 w-3 animate-pulse" />
        <span className="font-medium">{label}...</span>
      </div>
    </div>
  );
}

/* ── Links tab view ── */
function LinksView({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No links collected yet.
      </p>
    );
  }
  return (
    <div className="py-4">
      <ExpandedSources sources={sources} />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Chat Panel — Perplexity-style conversation view
   Tab state is owned by the parent (charles.tsx)
   ═══════════════════════════════════════════════ */

interface Props {
  messages: ChatMessageType[];
  isStreaming: boolean;
  currentTool: string | null;
  tab?: ChatTab;
  onSend: (text: string) => void;
  onNewSession: () => void;
  onNavigateToLinks?: () => void;
  onSaveCommand?: (label: string, prompt: string) => void;
  onToggleSidebar?: () => void;
  onClose?: () => void;
  sidebarOpen?: boolean;
}

export function ChatPanel({
  messages,
  isStreaming,
  currentTool,
  tab = "answer",
  onSend,
  onNewSession,
  onNavigateToLinks,
  onSaveCommand,
}: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && tab === "answer") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentTool, tab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const allSources = useMemo(() => collectSources(messages), [messages]);

  /* Find the user query that preceded each assistant message */
  function getUserQueryBefore(index: number): string | null {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Content area ── */}
      <div ref={scrollRef} className="chat-scrollbar flex-1 overflow-y-auto">
        {tab === "links" ? (
          <div className="max-w-3xl mx-auto px-6 py-2">
            <LinksView sources={allSources} />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                message={msg}
                userQuery={msg.role === "assistant" ? getUserQueryBefore(i) : undefined}
                onSaveCommand={onSaveCommand}
                onNavigateToLinks={onNavigateToLinks}
              />
            ))}

            {currentTool && <ToolActivity tool={currentTool} />}

            {isStreaming && !currentTool && (
              <div className="flex items-center gap-1 py-1">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Follow-up input (Perplexity-style) ── */}
      <div className="px-4 pb-4 pt-2">
        <form onSubmit={handleSubmit}>
          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up..."
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-1.5 text-sm outline-none placeholder:text-muted-foreground/60"
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground"
                  onClick={onNewSession}
                  title="New thread"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground"
                  title="Dictation (coming soon)"
                  disabled
                >
                  <Mic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  disabled={isStreaming || !input.trim()}
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
