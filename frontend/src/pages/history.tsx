import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search, FileText, Plus, Clock, MoreHorizontal, MessageSquare,
  ChevronDown, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useUserContext } from "@/contexts/UserContext";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useChatSessions, useDeleteChatSessions } from "@/hooks/use-chat-sessions";
import { useReports, downloadReportUrl } from "@/hooks/use-reports";
import type { ChatSession } from "@/hooks/use-chat";
import type { Report } from "@/hooks/use-reports";

type Tab = "threads" | "documents";
type SortOrder = "newest" | "oldest";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ThreadRow({
  session,
  prefix,
  selectMode,
  selected,
  onToggleSelect,
}: {
  session: ChatSession;
  prefix: string;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const content = (
    <div className="flex items-start gap-3 px-4 py-4 hover:bg-secondary/40 sidebar-transition group">
      {selectMode && (
        <div className="pt-1 shrink-0" onClick={(e) => e.preventDefault()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {session.title || "New conversation"}
        </p>
        {session.last_message_snippet && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {session.last_message_snippet}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDate(session.last_message_at || session.started_at)}
        </p>
      </div>
      {!selectMode && (
        <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 sidebar-transition" />
      )}
    </div>
  );

  if (selectMode) {
    return (
      <button
        className="w-full text-left border-b border-border/50 last:border-0"
        onClick={onToggleSelect}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={`${prefix}/charles?session=${session.id}`}
      className="block border-b border-border/50 last:border-0"
    >
      {content}
    </Link>
  );
}

function ThreadsList() {
  const { user } = useUserContext();
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: sessions, isLoading } = useChatSessions(portfolioId);
  const deleteSessions = useDeleteChatSessions(portfolioId);
  const prefix = user ? `/${user.id}` : "";

  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const filtered = useMemo(() => {
    let list = sessions ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) ||
          (s.last_message_snippet || "").toLowerCase().includes(q),
      );
    }
    if (sortOrder === "oldest") {
      list = [...list].reverse();
    }
    return list;
  }, [sessions, search, sortOrder]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    deleteSessions.mutate([...selectedIds], {
      onSuccess: () => {
        setSelectedIds(new Set());
        setSelectMode(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-8 w-48" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-4 py-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-24 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">No conversations yet</p>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Start a new thread with Charles to get AI-powered insights about your portfolio.
        </p>
        <Link to={`${prefix}/charles`}>
          <Button className="mt-4" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New thread
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your threads..."
          className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleExitSelect}
              >
                Done
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleDelete}
                  disabled={deleteSessions.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete ({selectedIds.size})
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectMode(true)}
            >
              Select
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
        >
          Sort: {sortOrder === "newest" ? "Newest" : "Oldest"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Thread list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No threads match your search.
          </p>
        ) : (
          filtered.map((s) => (
            <ThreadRow
              key={s.id}
              session={s}
              prefix={prefix}
              selectMode={selectMode}
              selected={selectedIds.has(s.id)}
              onToggleSelect={() => toggleSelect(s.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DocumentCard({ report }: { report: Report }) {
  const label = report.type?.replace(/_/g, " ") || "Report";

  return (
    <Card className="group overflow-hidden hover:shadow-md sidebar-transition cursor-pointer border-border">
      <a
        href={downloadReportUrl(report.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="flex items-center justify-center h-32 bg-muted/50">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <div className="px-3 py-2.5 border-t border-border">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium truncate flex-1 capitalize">{label}</p>
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 sidebar-transition" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.summary_sentence
              ? report.summary_sentence.slice(0, 60) + (report.summary_sentence.length > 60 ? "..." : "")
              : label}{" "}
            &middot; {formatDate(report.generated_at)}
          </p>
        </div>
      </a>
    </Card>
  );
}

function DocumentsGrid() {
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: reports, isLoading } = useReports(portfolioId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-32 w-full" />
            <div className="px-3 py-2.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20 mt-1" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const pdfReports = (reports ?? []).filter(
    (r) => r.status === "completed" || r.file_path,
  );

  if (pdfReports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">No documents yet</p>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Generated PDF reports will appear here. Try generating a report from the Reports page.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {pdfReports.map((r) => (
        <DocumentCard key={r.id} report={r} />
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("threads");
  const { user } = useUserContext();
  const prefix = user ? `/${user.id}` : "";

  return (
    <>
      <PageHeader title="History">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <button
              onClick={() => setTab("threads")}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 sidebar-transition -mb-px",
                tab === "threads"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Threads
            </button>
            <button
              onClick={() => setTab("documents")}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 sidebar-transition -mb-px",
                tab === "documents"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Documents
            </button>
          </div>
          <Link to={`${prefix}/charles`}>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
              <Plus className="h-3.5 w-3.5" />
              New Thread
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="container mx-auto max-w-7xl px-4 py-6">
        {tab === "threads" ? <ThreadsList /> : <DocumentsGrid />}
      </div>
    </>
  );
}
