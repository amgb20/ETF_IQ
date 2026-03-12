import { useState, useRef, useEffect } from "react";
import { MessageSquare, Plus, Trash2, ChevronLeft, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatSession } from "@/hooks/use-chat";

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onCollapse: () => void;
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SessionRow({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(session.title || "");
    setEditing(true);
  };

  const confirmEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-3 py-2 bg-secondary">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          className="flex-1 min-w-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <button onClick={confirmEdit} className="shrink-0 p-0.5 text-positive hover:text-positive/80" title="Save">
          <Check className="h-3 w-3" />
        </button>
        <button onClick={cancelEdit} className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground" title="Cancel">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors
        ${isActive ? "bg-secondary" : "hover:bg-secondary/50"}`}
    >
      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium">
          {session.title || "New conversation"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatRelative(session.last_message_at || session.started_at)}
        </p>
      </div>
      <div className="mt-0.5 hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <button
          onClick={startEdit}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
          title="Rename"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive-foreground"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </button>
  );
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onCollapse,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onCollapse}
          title="Close sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          Conversations
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onNew}
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="chat-scrollbar flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No conversations yet
          </p>
        )}

        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            isActive={s.id === activeSessionId}
            onSelect={() => onSelect(s.id)}
            onDelete={() => onDelete(s.id)}
            onRename={(title) => onRename(s.id, title)}
          />
        ))}
      </div>
    </div>
  );
}
