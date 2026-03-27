import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import {
  User, Sun, Moon, Monitor, LogOut, ChevronUp, ChevronRight, Check,
} from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";
import { useUser } from "@/hooks/use-user";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useUpdatePreferences } from "@/hooks/use-update-preferences";

const APPEARANCE_OPTIONS: readonly { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Return the icon component matching the current theme */
function themeIcon(theme: Theme): typeof Sun {
  switch (theme) {
    case "dark":  return Moon;
    case "system": return Monitor;
    default:       return Sun;
  }
}

/** Human-readable label, e.g. "System (Light)" */
function themeLabel(theme: Theme, resolved: "dark" | "light"): string {
  if (theme === "system") {
    return `System (${resolved === "dark" ? "Dark" : "Light"})`;
  }
  return theme === "dark" ? "Dark" : "Light";
}

export function ProfileMenu() {
  const navigate = useNavigate();
  const { user, logout } = useUserContext();
  const { data: profile } = useUser();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { mutate: updatePrefs } = useUpdatePreferences();
  const [open, setOpen] = useState(false);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const prefix = user ? `/${user.id}` : "";

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login");
  };

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    updatePrefs({ theme: t });
  };

  const CurrentIcon = themeIcon(theme);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left hover:bg-secondary/60 sidebar-transition"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="flex-1 truncate text-sm font-medium text-sidebar-foreground">
            {displayName}
          </span>
          <ChevronUp className="h-3.5 w-3.5 text-sidebar-muted shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-64 p-0 rounded-xl shadow-xl border-border"
      >
        <div className="py-1">
          {/* ── User info ── */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
            </div>
          </div>

          {/* ── Account ── */}
          <button
            onClick={() => { setOpen(false); navigate(`${prefix}/account`); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/60 sidebar-transition"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Account</span>
          </button>

          {/* ── Appearance (hover submenu) ── */}
          <div className="relative group/appearance">
            {/* Trigger row */}
            <div className="flex w-full items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/60 sidebar-transition cursor-default">
              <CurrentIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">Appearance</span>
                <span className="block text-xs text-muted-foreground leading-tight">
                  {themeLabel(theme, resolvedTheme)}
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>

            {/* Flyout submenu — visible on hover */}
            <div
              className="
                invisible opacity-0 group-hover/appearance:visible group-hover/appearance:opacity-100
                absolute left-full top-0 ml-1 z-50
                w-44 rounded-xl border border-border bg-popover py-1 shadow-xl
                transition-[opacity,visibility] duration-150
              "
            >
              {APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/60 sidebar-transition"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                  {theme === value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border my-1" />

          {/* ── Sign out ── */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/60 sidebar-transition text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
