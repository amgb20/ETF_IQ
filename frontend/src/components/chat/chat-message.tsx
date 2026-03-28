import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Copy,
  Download,
  Bookmark,
  Check,
  ChevronDown,
  Globe,
  BookOpen,
  Bell,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ChatMessage as ChatMessageType,
  ChatSource,
} from "@/hooks/use-chat";
import { SourcePills } from "./source-chips";

/* ── Tool label map ── */
function toolLabel(tool: string): { label: string; icon: typeof Globe } {
  switch (tool) {
    case "web_search":
      return { label: "Web search", icon: Globe };
    case "create_alert":
      return { label: "Create alert", icon: Bell };
    case "report_history":
      return { label: "Report history", icon: BookOpen };
    default:
      return { label: "Internal knowledge", icon: Database };
  }
}

/* ── Expandable tool steps ── */
function ToolSteps({ tools }: { tools: { tool: string; query?: string }[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 sidebar-transition"
      >
        <span>
          Completed {tools.length} step{tools.length !== 1 ? "s" : ""}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 pl-1">
          {tools.map((t, i) => {
            const { label, icon: Icon } = toolLabel(t.tool);
            return (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{label}</span>
                {t.query && (
                  <span className="truncate text-[10px] text-muted-foreground/60 italic">
                    &mdash; {t.query}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Response action bar ── */
function ResponseActions({
  content,
  userQuery,
  onSaveCommand,
}: {
  content: string;
  userQuery: string | null;
  onSaveCommand?: (label: string, prompt: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "charles-response.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (!userQuery || !onSaveCommand) return;
    const label =
      userQuery.length > 30 ? userQuery.slice(0, 30) + "..." : userQuery;
    onSaveCommand(label, userQuery);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex items-center gap-1 mt-3">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 sidebar-transition"
        title="Copy response"
      >
        {copied ? (
          <Check className="h-3 w-3 text-positive" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 sidebar-transition"
        title="Download as .txt"
      >
        <Download className="h-3 w-3" />
        Download
      </button>
      {userQuery && onSaveCommand && (
        <button
          onClick={handleSave}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 sidebar-transition"
          title="Save query as shortcut"
        >
          {saved ? (
            <Check className="h-3 w-3 text-positive" />
          ) : (
            <Bookmark className="h-3 w-3" />
          )}
          {saved ? "Saved" : "Save shortcut"}
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Chat Message
   ═══════════════════════════════════════════════ */

interface Props {
  message: ChatMessageType;
  /** The user query that preceded this response (for "save shortcut") */
  userQuery?: string | null;
  /** Callback to save query as a command */
  onSaveCommand?: (label: string, prompt: string) => void;
  /** Navigate to Links tab when clicking source pills */
  onNavigateToLinks?: () => void;
}

export function ChatMessage({
  message,
  userQuery,
  onSaveCommand,
  onNavigateToLinks,
}: Props) {
  const isUser = message.role === "user";

  /* ── User message: right-aligned grey pill ── */
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-secondary/80 px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  /* ── Assistant message ── */
  return (
    <div className="w-full group/msg">
      {/* Expandable tool steps */}
      {message.tools_used && message.tools_used.length > 0 && (
        <ToolSteps tools={message.tools_used} />
      )}

      {/* Markdown body */}
      <div className="chat-prose text-sm leading-relaxed break-words">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>

      {/* Stacked source favicon pills */}
      {message.sources && message.sources.length > 0 && (
        <SourcePills sources={message.sources} onClick={onNavigateToLinks} />
      )}

      {/* Action bar: Copy, Download, Save shortcut */}
      {message.content && (
        <ResponseActions
          content={message.content}
          userQuery={userQuery ?? null}
          onSaveCommand={onSaveCommand}
        />
      )}
    </div>
  );
}
