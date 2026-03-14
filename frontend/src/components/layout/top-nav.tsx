import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MessageSquare, LogOut, LogIn, Bell, Settings, FileText, AlertTriangle, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/contexts/UserContext";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/use-notifications";
import type { AppNotification } from "@/hooks/use-notifications";

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

function notifIcon(type: AppNotification["type"]) {
  switch (type) {
    case "report_ready":
      return <FileText className="h-4 w-4 text-green-500 shrink-0" />;
    case "alert_triggered":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "alert_configured":
      return <Bell className="h-4 w-4 text-blue-500 shrink-0" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useUserContext();

  const { data: notifications } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  const prefix = user ? `/${user.id}` : "";
  const navLinks = [
    { to: `${prefix}/dashboard`, label: "Dashboard" },
    { to: `${prefix}/analysis`, label: "Analysis" },
    { to: `${prefix}/reports`, label: "Reports" },
  ];

  const handleNotifClick = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.type === "report_ready") navigate(`${prefix}/reports`);
    else navigate(`${prefix}/analysis/alerts`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center px-4">
        <Link
          to={user ? `/${user.id}/dashboard` : "/"}
          className="mr-8 text-lg tracking-tight"
          style={{ fontFamily: "'Cormorant Garamond', serif", color: '#C9A84C', fontWeight: 600 }}
        >
          ETF IQ
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                location.pathname.startsWith(link.to)
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => markAllRead.mutate()}
                  >
                    <CheckCheck className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {(!notifications || notifications.length === 0) ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No notifications yet.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent",
                        !n.is_read && "bg-accent/50",
                      )}
                      onClick={() => handleNotifClick(n)}
                    >
                      {notifIcon(n.type)}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm leading-tight", !n.is_read && "font-medium")}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {n.message}
                          </p>
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

          <Link to={`${prefix}/settings`}>
            <Button variant="ghost" size="icon" title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            title="Chat"
            onClick={() => {
              const bar = document.querySelector("[data-chatbot-toggle]") as HTMLButtonElement | null;
              bar?.click();
            }}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {user?.email}
              </span>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
              <LogIn className="h-4 w-4 mr-1" />
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
