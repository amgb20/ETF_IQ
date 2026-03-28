import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  Plus,
  Clock,
  MoreHorizontal,
  MessageSquare,
  ChevronDown,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useUserContext } from "@/contexts/UserContext";
import { usePortfolios } from "@/hooks/use-portfolios";
import {
  useChatSessions,
  useDeleteChatSession,
  useRenameChatSession,
  useDeleteChatSessions,
} from "@/hooks/use-chat-sessions";
import { useReports, downloadReportUrl } from "@/hooks/use-reports";
import { useTransactions } from "@/hooks/use-transactions";
import type { Transaction } from "@/hooks/use-transactions";
import type { ChatSession } from "@/hooks/use-chat";
import type { Report } from "@/hooks/use-reports";

type Tab = "threads" | "trades" | "documents";
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
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Thread action menu (rename / delete) ── */
function ThreadActionMenu({
  session,
  onDelete,
  onRename,
}: {
  session: ChatSession;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  const startRename = () => {
    setDraft(session.title || "");
    setRenaming(true);
    setOpen(false);
  };

  const confirmRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          className="w-40 rounded border border-input bg-background px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={confirmRename}
          className="p-0.5 text-positive hover:text-positive/80"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setRenaming(false)}
          className="p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 sidebar-transition">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="w-36 p-1 rounded-xl"
      >
        <button
          onClick={startRename}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs hover:bg-secondary/60 sidebar-transition"
        >
          <Pencil className="h-3 w-3" />
          Rename
        </button>
        <button
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 sidebar-transition"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </PopoverContent>
    </Popover>
  );
}

/* ── Thread row — Perplexity-style: blends with background ── */
function ThreadRow({
  session,
  prefix,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
  onRename,
}: {
  session: ChatSession;
  prefix: string;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const navigate = useNavigate();

  const handleRowClick = () => {
    if (selectMode) {
      onToggleSelect();
    } else {
      navigate(`${prefix}/charles?session=${session.id}`);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleRowClick();
      }}
      className="border-b border-border/40 last:border-0 cursor-pointer"
    >
      <div className="flex items-start gap-3 py-5 group">
        {selectMode && (
          <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground line-clamp-1">
            {session.title || "New conversation"}
          </p>
          {session.last_message_snippet && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {session.last_message_snippet}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(session.last_message_at || session.started_at)}
          </p>
        </div>
        {/* Action menu is a sibling, NOT inside a <Link> */}
        {!selectMode && (
          <div onClick={(e) => e.stopPropagation()}>
            <ThreadActionMenu
              session={session}
              onDelete={onDelete}
              onRename={onRename}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Threads list ── */
function ThreadsList() {
  const { user } = useUserContext();
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: sessions, isLoading } = useChatSessions(portfolioId);
  const deleteSessions = useDeleteChatSessions(portfolioId);
  const deleteSession = useDeleteChatSession(portfolioId);
  const renameSession = useRenameChatSession(portfolioId);
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
          (s.last_message_snippet || "").toLowerCase().includes(q)
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

  const handleBulkDelete = () => {
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
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-full rounded-xl" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="py-5 space-y-2 border-b border-border/40">
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
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-3xl mx-auto">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">No conversations yet</p>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Start a new thread with Charles to get AI-powered insights about your
          portfolio.
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
    <div className="max-w-3xl mx-auto space-y-4">
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
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }}
              >
                Done
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleBulkDelete}
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
          onClick={() =>
            setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))
          }
        >
          Sort: {sortOrder === "newest" ? "Newest" : "Oldest"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Thread list — no card wrapper, blends with background */}
      <div className="divide-y divide-border/40">
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
              onDelete={() => deleteSession.mutate(s.id)}
              onRename={(title) =>
                renameSession.mutate({ sessionId: s.id, title })
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Documents grid ── */
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
            <p className="text-sm font-medium truncate flex-1 capitalize">
              {label}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.summary_sentence
              ? report.summary_sentence.slice(0, 60) +
                (report.summary_sentence.length > 60 ? "..." : "")
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-3xl mx-auto">
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
    (r) => r.status === "completed" || r.file_path
  );

  if (pdfReports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-3xl mx-auto">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">No documents yet</p>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Generated PDF reports will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
      {pdfReports.map((r) => (
        <DocumentCard key={r.id} report={r} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Trades Tab — Journal + By ETF views
   ═══════════════════════════════════════════════ */

type TradeView = "journal" | "by-etf";

function TradesList() {
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: transactions, isLoading } = useTransactions(portfolioId);
  const [view, setView] = useState<TradeView>("journal");

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-4 py-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium mb-1">No trades yet</p>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Your buy and sell transactions will appear here as you trade.
        </p>
      </div>
    );
  }

  const grouped = transactions.reduce<Record<string, Transaction[]>>(
    (acc, t) => {
      const key = t.etf_isin || t.position_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(t);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
          <button
            onClick={() => setView("journal")}
            className={cn(
              "px-3 py-1.5 sidebar-transition",
              view === "journal"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Journal
          </button>
          <button
            onClick={() => setView("by-etf")}
            className={cn(
              "px-3 py-1.5 sidebar-transition",
              view === "by-etf"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            By ETF
          </button>
        </div>
      </div>

      {view === "journal" ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">ETF</th>
                <th className="text-right px-4 py-2 font-medium">Shares</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th className="text-right px-4 py-2 font-medium">P&L</th>
                <th className="text-right px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        t.type === "buy"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-500"
                      )}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">
                      {t.ticker_yf || t.etf_isin || "—"}
                    </span>
                  </td>
                  <td className="text-right px-4 py-2.5 tabular-nums">
                    {t.shares}
                  </td>
                  <td className="text-right px-4 py-2.5 tabular-nums">
                    {t.price.toFixed(2)}
                  </td>
                  <td className="text-right px-4 py-2.5 tabular-nums">
                    {t.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="text-right px-4 py-2.5 tabular-nums">
                    {t.type === "sell" && t.realized_pnl != null ? (
                      <span
                        className={
                          t.realized_pnl >= 0
                            ? "text-green-600"
                            : "text-red-500"
                        }
                      >
                        {t.realized_pnl >= 0 ? "+" : ""}
                        {t.realized_pnl.toFixed(2)}
                        {t.realized_pnl_pct != null && (
                          <span className="text-xs ml-0.5">
                            ({t.realized_pnl >= 0 ? "+" : ""}
                            {t.realized_pnl_pct.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right px-4 py-2.5 text-muted-foreground text-xs">
                    {t.trade_date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([key, txns]) => {
            const first = txns[0];
            const label =
              first.ticker_yf || first.etf_name || first.etf_isin || key;
            const buys = txns.filter((t) => t.type === "buy");
            const sells = txns.filter((t) => t.type === "sell");
            const totalBought = buys.reduce((s, t) => s + t.shares, 0);
            const totalSold = sells.reduce((s, t) => s + t.shares, 0);
            const totalBuyAmount = buys.reduce((s, t) => s + t.amount, 0);
            const totalSellAmount = sells.reduce((s, t) => s + t.amount, 0);
            const avgBuyPrice = totalBought ? totalBuyAmount / totalBought : 0;
            const avgSellPrice = totalSold ? totalSellAmount / totalSold : 0;
            const totalPnl = sells.reduce(
              (s, t) => s + (t.realized_pnl ?? 0),
              0
            );

            return (
              <Card key={key} className="overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm">{label}</span>
                      {first.etf_name && first.ticker_yf && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {first.etf_name}
                        </span>
                      )}
                    </div>
                    {totalSold > 0 && (
                      <span
                        className={cn(
                          "text-sm font-medium",
                          totalPnl >= 0 ? "text-green-600" : "text-red-500"
                        )}
                      >
                        P&L: {totalPnl >= 0 ? "+" : ""}
                        {totalPnl.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>
                      Bought: {totalBought} @ avg {avgBuyPrice.toFixed(2)}
                    </span>
                    {totalSold > 0 && (
                      <span>
                        Sold: {totalSold} @ avg {avgSellPrice.toFixed(2)}
                      </span>
                    )}
                    <span>
                      Remaining:{" "}
                      {(totalBought - totalSold)
                        .toFixed(6)
                        .replace(/\.?0+$/, "") || "0"}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  {txns.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-4 py-2 text-sm"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          t.type === "buy"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-red-500/10 text-red-500"
                        )}
                      >
                        {t.type}
                      </span>
                      <span className="tabular-nums">
                        {t.shares} @ {t.price.toFixed(2)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {t.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="flex-1" />
                      {t.type === "sell" && t.realized_pnl != null && (
                        <span
                          className={cn(
                            "tabular-nums text-xs",
                            t.realized_pnl >= 0
                              ? "text-green-600"
                              : "text-red-500"
                          )}
                        >
                          {t.realized_pnl >= 0 ? "+" : ""}
                          {t.realized_pnl.toFixed(2)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {t.trade_date}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   History Page — Perplexity-style centered layout
   ═══════════════════════════════════════════════ */

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("threads");
  const { user } = useUserContext();
  const prefix = user ? `/${user.id}` : "";

  return (
    <>
      {/* Header: History left, centered tabs, + New Thread right */}
      <div className="sticky top-12 md:top-0 z-30 bg-background">
        <div className="container mx-auto max-w-7xl px-4 flex items-center h-11">
          {/* Left: title */}
          <h1 className="text-sm font-medium text-foreground w-32 shrink-0">
            History
          </h1>

          {/* Center: tabs */}
          <div className="flex-1 flex items-center justify-center gap-1">
            <button
              onClick={() => setTab("threads")}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 sidebar-transition",
                tab === "threads"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Threads
            </button>
            <button
              onClick={() => setTab("trades")}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 sidebar-transition",
                tab === "trades"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Trades
            </button>
            <button
              onClick={() => setTab("documents")}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 sidebar-transition",
                tab === "documents"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Documents
            </button>
          </div>

          {/* Right: + New Thread */}
          <div className="w-32 flex justify-end shrink-0">
            <Link to={`${prefix}/charles`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                New Thread
              </Button>
            </Link>
          </div>
        </div>
        <div className="h-px bg-border" />
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        {tab === "threads" && <ThreadsList />}
        {tab === "trades" && <TradesList />}
        {tab === "documents" && <DocumentsGrid />}
      </div>
    </>
  );
}
