import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus, Mic, AudioLines, Send, Trash2,
  Sparkles, Globe, Share2, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel, type ChatTab } from "@/components/chat/chat-panel";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useChat } from "@/hooks/use-chat";
import { useCommands, type UserCommand } from "@/hooks/use-commands";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";

/* ─── Command pills row ─── */
function CommandPills({
  commands,
  onSelect,
}: {
  commands: UserCommand[];
  onSelect: (prompt: string) => void;
}) {
  if (commands.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-5">
      {commands.map((cmd) => (
        <button
          key={cmd.id}
          onClick={() => onSelect(cmd.prompt)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary/60 sidebar-transition"
          title={cmd.prompt}
        >
          {cmd.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Add command popover (inside the + button) ─── */
function AddCommandPopover({
  commands,
  onAdd,
  onRemove,
}: {
  commands: UserCommand[];
  onAdd: (label: string, prompt: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !prompt.trim()) return;
    onAdd(label.trim(), prompt.trim());
    setLabel("");
    setPrompt("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          title="Manage commands"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-80 p-0 rounded-xl">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium">Quick Commands</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create shortcuts that appear as pills below the input
          </p>
        </div>

        {commands.length > 0 && (
          <div className="max-h-40 overflow-y-auto chat-scrollbar">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="flex items-center gap-2 px-4 py-2 hover:bg-secondary/40 sidebar-transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{cmd.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{cmd.prompt}</p>
                </div>
                <button
                  onClick={() => onRemove(cmd.id)}
                  className="shrink-0 p-1 text-muted-foreground hover:text-destructive sidebar-transition rounded"
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-3 border-t border-border space-y-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Asia summary)"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt (e.g. Summarize my Asian positions)"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            type="submit"
            size="sm"
            className="w-full text-xs h-7"
            disabled={!label.trim() || !prompt.trim()}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add command
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════
   New Thread View — Perplexity-style welcome
   ═══════════════════════════════════════════════ */

function NewThreadView({
  onSend,
  isStreaming,
}: {
  onSend: (text: string) => void;
  isStreaming: boolean;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { commands, addCommand, removeCommand } = useCommands();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  return (
    <div className="relative flex flex-col items-center justify-center h-[calc(100vh-10rem)] md:h-[calc(100vh-7.5rem)]">
      <div className="flex flex-col items-center w-full max-w-2xl px-4">

        <h2 className="text-center mb-8">
          <span
            className="font-brand text-4xl md:text-5xl tracking-tight"
            style={{ color: "#C9A84C", fontWeight: 600 }}
          >
            ETF IQ
          </span>
          <span className="text-4xl md:text-5xl font-light text-foreground/70">
            {" "}&mdash;{" "}
          </span>
          <span className="text-3xl md:text-4xl font-light text-foreground/80">
            Charles
          </span>
        </h2>

        {/* Input box with crab mascot positioned top-left */}
        <form onSubmit={handleSubmit} className="w-full relative">
          {/* Crab mascot — top-left of the dialog box */}
          <object
            data="/crab-mascot.svg"
            type="image/svg+xml"
            aria-label="Charles the crab mascot"
            className="absolute -top-[70px] -left-[30px] w-[80px] h-auto pointer-events-none"
          />
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={2}
              className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-sm outline-none placeholder:text-muted-foreground/60"
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1">
                <AddCommandPopover
                  commands={commands}
                  onAdd={addCommand}
                  onRemove={removeCommand}
                />
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground" title="Dictation (coming soon)" disabled>
                  <Mic className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground" title="Voice mode (coming soon)" disabled>
                  <AudioLines className="h-4 w-4" />
                </Button>
                <Button type="submit" size="icon" className="h-8 w-8 rounded-full" disabled={isStreaming || !input.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </form>

        <CommandPills commands={commands} onSelect={(p) => onSend(p)} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Chat Header — "Charles" left, Answer|Links center, actions right
   ═══════════════════════════════════════════════ */

function ChatHeader({
  tab,
  onTabChange,
}: {
  tab: ChatTab;
  onTabChange: (t: ChatTab) => void;
}) {
  return (
    <div className="sticky top-12 md:top-0 z-30 bg-background">
      <div className="container mx-auto max-w-7xl px-4 flex items-center h-11">
        {/* Left: title */}
        <h1 className="text-sm font-medium text-foreground w-32 shrink-0">Charles</h1>

        {/* Center: tabs */}
        <div className="flex-1 flex items-center justify-center gap-1">
          <button
            onClick={() => onTabChange("answer")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 sidebar-transition",
              tab === "answer"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Answer
          </button>
          <button
            onClick={() => onTabChange("links")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 sidebar-transition",
              tab === "links"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            Links
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 w-32 justify-end shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Share" disabled>
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="More" disabled>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="h-px bg-border" />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Charles Page
   ═══════════════════════════════════════════════ */

export default function CharlesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSessionId = searchParams.get("session");
  const [tab, setTab] = useState<ChatTab>("answer");

  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;

  const {
    messages,
    isStreaming,
    currentTool,
    sendMessage,
    newSession,
    switchSession,
  } = useChat(portfolioId);

  /* Load a specific session from URL */
  useEffect(() => {
    if (urlSessionId) {
      switchSession(urlSessionId);
      setTab("answer");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId]);

  /* Reset to clean state when navigating to /charles without ?session= */
  useEffect(() => {
    if (!urlSessionId) {
      newSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId]);

  const { addCommand } = useCommands();

  const handleNewSession = () => {
    newSession();
    setSearchParams({});
    setTab("answer");
  };

  const handleNavigateToLinks = useCallback(() => setTab("links"), []);

  /* Show NewThreadView when no messages (fresh state) */
  const showChat = messages.length > 0;

  return (
    <>
      {showChat ? (
        <>
          <ChatHeader tab={tab} onTabChange={setTab} />
          <div className="h-[calc(100vh-7rem)] md:h-[calc(100vh-4.5rem)]">
            <ChatPanel
              messages={messages}
              isStreaming={isStreaming}
              currentTool={currentTool}
              tab={tab}
              onSend={sendMessage}
              onNewSession={handleNewSession}
              onNavigateToLinks={handleNavigateToLinks}
              onSaveCommand={addCommand}
            />
          </div>
        </>
      ) : (
        <NewThreadView onSend={sendMessage} isStreaming={isStreaming} />
      )}
    </>
  );
}
