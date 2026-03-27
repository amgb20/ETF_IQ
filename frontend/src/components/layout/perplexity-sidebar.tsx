import { Link, useLocation } from "react-router-dom";
import {
  Plus, Clock, LayoutDashboard, LineChart, FileText, Bell,
  CheckCheck, AlertTriangle, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/contexts/UserContext";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import {
  useNotifications, useMarkRead, useMarkAllRead,
} from "@/hooks/use-notifications";
import type { AppNotification } from "@/hooks/use-notifications";
import { downloadReportUrl } from "@/hooks/use-reports";
import { ProfileMenu } from "./profile-menu";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";

/* ── Navigation items ── */
const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "dashboard" },
  { label: "Analytics", icon: LineChart, path: "analysis" },
  { label: "Reports", icon: FileText, path: "reports" },
];

/* ── Notification icon helper ── */
function notifIcon(type: AppNotification["type"]) {
  switch (type) {
    case "report_ready":
      return <FileText className="h-4 w-4 text-green-500 shrink-0" />;
    case "alert_triggered":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Notification Bell ── */
function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useUserContext();
  const { data: notifications } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const prefix = user ? `/${user.id}` : "";
  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  const handleNotifClick = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.type === "report_ready") {
      navigate(`${prefix}/reports`);
      if (n.ref_id) window.open(downloadReportUrl(n.ref_id), "_blank");
    } else {
      navigate(`${prefix}/analysis/alerts`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/60 sidebar-transition">
          <Bell className="h-4 w-4 text-sidebar-muted" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-80 p-0 rounded-xl">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sidebar-transition"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {(!notifications || notifications.length === 0) ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-2.5 text-left sidebar-transition hover:bg-secondary/60",
                  !n.is_read && "bg-secondary/40",
                )}
                onClick={() => handleNotifClick(n)}
              >
                {notifIcon(n.type)}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm leading-tight", !n.is_read && "font-medium")}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                  {timeAgo(n.created_at)}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════
   Perplexity Sidebar
   ═══════════════════════════════════════════════ */

interface PerplexitySidebarProps {
  onNavClick?: () => void;
}

export function PerplexitySidebar({ onNavClick }: PerplexitySidebarProps) {
  const location = useLocation();
  const { user } = useUserContext();
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: sessions } = useChatSessions(portfolioId);

  const prefix = user ? `/${user.id}` : "";
  const recentThreads = (sessions ?? []).slice(0, 4);

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* ── Logo ── */}
      <div className="flex items-center h-14 px-4">
        <Link
          to={user ? `${prefix}/dashboard` : "/"}
          className="font-brand text-xl tracking-tight"
          style={{ color: "#C9A84C", fontWeight: 600 }}
          onClick={onNavClick}
        >
          ETF IQ
        </Link>
      </div>

      {/* ── Primary nav ── */}
      <nav className="flex flex-col gap-0.5 px-3">
        {/* New thread */}
        <Link
          to={`${prefix}/charles`}
          onClick={onNavClick}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium sidebar-transition",
            location.pathname.endsWith("/charles")
              ? "bg-secondary text-foreground"
              : "text-sidebar-muted hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          <Plus className="h-4 w-4" />
          <span>New thread</span>
        </Link>

        {/* History */}
        <Link
          to={`${prefix}/history`}
          onClick={onNavClick}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium sidebar-transition",
            location.pathname.includes("/history")
              ? "bg-secondary text-foreground"
              : "text-sidebar-muted hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          <Clock className="h-4 w-4" />
          <span>History</span>
        </Link>

        {/* Separator */}
        <div className="border-t border-sidebar-border my-2" />

        {/* Main nav items */}
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const to = `${prefix}/${path}`;
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={path}
              to={to}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium sidebar-transition",
                active
                  ? "bg-secondary text-foreground"
                  : "text-sidebar-muted hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Recent threads ── */}
      {recentThreads.length > 0 && (
        <div className="mt-6 px-3 flex-1 min-h-0 overflow-hidden">
          <p className="text-[11px] font-medium text-sidebar-muted uppercase tracking-wider px-3 mb-2">
            Recent
          </p>
          <div className="space-y-0.5 overflow-y-auto max-h-full chat-scrollbar">
            {recentThreads.map((s) => (
              <Link
                key={s.id}
                to={`${prefix}/charles?session=${s.id}`}
                onClick={onNavClick}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-sidebar-muted hover:bg-secondary/60 hover:text-foreground sidebar-transition truncate"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs">{s.title || "New conversation"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Bottom bar: Profile + Bell ── */}
      <div className="border-t border-sidebar-border px-3 py-2 flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <ProfileMenu />
        </div>
        <NotificationBell />
      </div>
    </div>
  );
}
