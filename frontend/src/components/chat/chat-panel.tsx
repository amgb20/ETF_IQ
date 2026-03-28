import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Globe, BookOpen, Bell, Plus, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";
import { ExpandedSources, collectSources } from "./source-chips";
import type {
  ChatMessage as ChatMessageType,
  ChatSource,
} from "@/hooks/use-chat";

export type ChatTab = "answer" | "links";

/* ── Tool activity pill ── */
function ToolActivity({ tool }: { tool: string }) {
  const label =
    tool === "web_search"
      ? "Searching the web"
      : tool === "create_alert"
        ? "Creating alert"
        : "Searching reports";

  const Icon =
    tool === "web_search" ? Globe : tool === "create_alert" ? Bell : BookOpen;

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex items-center gap-1.5 text-xs text-primary">
        <Icon className="h-3 w-3 animate-pulse" />
        <span className="font-medium">{label}...</span>
      </div>
    </div>
  );
}

/* ── Links tab — gallery cards ── */
function LinksView({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Globe className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium mb-1">No links yet</p>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Sources from web searches will appear here as cards.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
      {sources.map((source) => {
        const href = source.url || source.uri || "";
        if (!href) return null;
        const domain = (() => {
          try {
            return new URL(href).hostname.replace(/^www\./, "");
          } catch {
            return href;
          }
        })();
        const favicon = (() => {
          try {
            return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(href).hostname}`;
          } catch {
            return "";
          }
        })();

        return (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:shadow-md sidebar-transition no-underline"
          >
            {/* Preview image area */}
            <div className="h-28 bg-muted/40 flex items-center justify-center overflow-hidden">
              <img
                src={`https://api.microlink.io/?url=${encodeURIComponent(href)}&screenshot=true&meta=false&embed=screenshot.url`}
                alt=""
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 sidebar-transition"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            {/* Info */}
            <div className="px-3 py-2.5 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <img
                  src={favicon}
                  alt=""
                  width={14}
                  height={14}
                  className="shrink-0 rounded-sm"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
                <span className="text-[11px] text-muted-foreground truncate">
                  {domain}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary sidebar-transition">
                {source.title || domain}
              </p>
            </div>
          </a>
        );
      })}
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
                userQuery={
                  msg.role === "assistant" ? getUserQueryBefore(i) : undefined
                }
                onSaveCommand={onSaveCommand}
                onNavigateToLinks={onNavigateToLinks}
              />
            ))}

            {currentTool && <ToolActivity tool={currentTool} />}

            {isStreaming && !currentTool && (
              <div className="flex items-center gap-1 py-1">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Follow-up input (Perplexity-style) — hidden on Links tab ── */}
      {tab === "answer" && (
        <div className="px-4 pb-4 pt-2">
          <form onSubmit={handleSubmit}>
            <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up..."
                rows={1}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-1.5 text-sm outline-none placeholder:text-muted-foreground/60"
                style={{ minHeight: "2.25rem", maxHeight: "160px" }}
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
      )}
    </div>
  );
}
