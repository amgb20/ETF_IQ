import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare, LogOut, LogIn, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/contexts/UserContext";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useAlerts } from "@/hooks/use-alerts";

const NAV_LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/analysis", label: "Analysis" },
  { to: "/reports", label: "Reports" },
];

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useUserContext();

  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: alerts } = useAlerts(portfolioId);

  const unreadCount = (alerts ?? []).reduce((acc, a) => {
    const recent = a.events.filter((ev) => {
      if (!ev.triggered_at) return false;
      const hourAgo = Date.now() - 24 * 60 * 60 * 1000;
      return new Date(ev.triggered_at).getTime() > hourAgo;
    });
    return acc + recent.length;
  }, 0);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center px-4">
        <Link to="/" className="mr-8 text-lg font-bold tracking-tight">
          PortfolioIQ
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
                location.pathname === link.to ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/analysis?tab=alerts" className="relative">
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
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
