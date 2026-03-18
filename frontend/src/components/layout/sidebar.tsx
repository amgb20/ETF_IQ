import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, LineChart, FileText, Settings,
  LogOut, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/contexts/UserContext";
import { useUser } from "@/hooks/use-user";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "dashboard" },
  { label: "Analysis", icon: LineChart, path: "analysis" },
  { label: "Reports", icon: FileText, path: "reports" },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUserContext();
  const { data: profile } = useUser();

  const prefix = user ? `/${user.id}` : "";
  const displayName = profile?.display_name || user?.email || "";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden md:flex flex-col h-full border-r border-border bg-card/50 transition-all duration-200 shrink-0",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center h-14 px-3", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <Link
              to={user ? `/${user.id}/dashboard` : "/"}
              className="text-lg tracking-tight"
              style={{ fontFamily: "'Cormorant Garamond', serif", color: "#C9A84C", fontWeight: 600 }}
            >
              ETF IQ
            </Link>
          )}
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 px-2 pt-2">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const to = `${prefix}/${path}`;
            const active = location.pathname.startsWith(to);

            const linkContent = (
              <Link
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={path}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }
            return <div key={path}>{linkContent}</div>;
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border px-2 py-3 flex flex-col gap-1">
          {/* User info */}
          {!collapsed && displayName && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-muted-foreground truncate">{displayName}</span>
            </div>
          )}

          {/* Settings */}
          {(() => {
            const settingsLink = (
              <Link
                to={`${prefix}/settings`}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  location.pathname.startsWith(`${prefix}/settings`)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  collapsed && "justify-center px-0",
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Settings</span>}
              </Link>
            );
            if (collapsed) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
                  <TooltipContent side="right">Settings</TooltipContent>
                </Tooltip>
              );
            }
            return settingsLink;
          })()}

          {/* Logout */}
          {(() => {
            const logoutBtn = (
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full text-muted-foreground hover:text-foreground hover:bg-muted",
                  collapsed && "justify-center px-0",
                )}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Logout</span>}
              </button>
            );
            if (collapsed) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>{logoutBtn}</TooltipTrigger>
                  <TooltipContent side="right">Logout</TooltipContent>
                </Tooltip>
              );
            }
            return logoutBtn;
          })()}
        </div>
      </aside>
    </TooltipProvider>
  );
}

export function MobileSidebarContent({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUserContext();
  const { data: profile } = useUser();

  const prefix = user ? `/${user.id}` : "";
  const displayName = profile?.display_name || user?.email || "";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center h-14 px-4">
        <Link
          to={user ? `/${user.id}/dashboard` : "/"}
          className="text-lg tracking-tight"
          style={{ fontFamily: "'Cormorant Garamond', serif", color: "#C9A84C", fontWeight: 600 }}
          onClick={onClose}
        >
          ETF IQ
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-3 pt-2">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const to = `${prefix}/${path}`;
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={path}
              to={to}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-3 flex flex-col gap-1">
        {displayName && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-muted-foreground truncate">{displayName}</span>
          </div>
        )}

        <Link
          to={`${prefix}/settings`}
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
            location.pathname.startsWith(`${prefix}/settings`)
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors w-full text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
