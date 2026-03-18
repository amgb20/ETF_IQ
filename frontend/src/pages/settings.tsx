import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUser } from "@/hooks/use-user";
import { useUpdatePreferences } from "@/hooks/use-update-preferences";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  usePortfolios,
  usePortfolioThemes,
  useCreateTheme,
  useUpdateTheme,
  useDeleteTheme,
  type ThemeBrief,
} from "@/hooks/use-portfolios";
import { Sun, Moon, Monitor, Plus, Pencil, Trash2, Check, X } from "lucide-react";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD"];

export default function SettingsPage() {
  const { data: user, isLoading } = useUser();
  const { mutate: updatePrefs } = useUpdatePreferences();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (user) setDisplayName(user.display_name ?? "");
  }, [user]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4 space-y-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!user) return null;

  function handleThemeChange(value: string) {
    if (!value) return;
    const t = value as Theme;
    setTheme(t);
    updatePrefs({ theme: t });
  }

  function handleCurrencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updatePrefs({ base_currency: e.target.value });
  }

  function handleNotifyEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    updatePrefs({ notify_email: e.target.checked });
  }

  function handleNotifyDigestChange(e: React.ChangeEvent<HTMLInputElement>) {
    updatePrefs({ notify_digest: e.target.checked });
  }

  function handleSaveDisplayName() {
    updatePrefs({ display_name: displayName || null });
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button onClick={handleSaveDisplayName} size="sm">Save</Button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred color theme</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={handleThemeChange}
            className="justify-start"
          >
            <ToggleGroupItem value="light" className="gap-1.5">
              <Sun className="h-4 w-4" />
              Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="gap-1.5">
              <Moon className="h-4 w-4" />
              Dark
            </ToggleGroupItem>
            <ToggleGroupItem value="system" className="gap-1.5">
              <Monitor className="h-4 w-4" />
              System
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      {/* Portfolio Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Preferences</CardTitle>
          <CardDescription>Default currency for portfolio calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <label className="text-sm font-medium">Base Currency</label>
            <select
              value={user.base_currency}
              onChange={handleCurrencyChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Control how you receive alerts and updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={user.notify_email}
              onChange={handleNotifyEmailChange}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <div>
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-xs text-muted-foreground">Receive price alerts and portfolio updates by email</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={user.notify_digest}
              onChange={handleNotifyDigestChange}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <div>
              <p className="text-sm font-medium">Weekly Digest</p>
              <p className="text-xs text-muted-foreground">Receive a weekly summary of your portfolio performance</p>
            </div>
          </label>
        </CardContent>
      </Card>

      <ThemeManagementSection />
    </div>
  );
}


function ThemeManagementSection() {
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: themes, isLoading } = usePortfolioThemes(portfolioId);

  const createTheme = portfolioId ? useCreateTheme(portfolioId) : null;
  const updateTheme = portfolioId ? useUpdateTheme(portfolioId) : null;
  const deleteTheme = portfolioId ? useDeleteTheme(portfolioId) : null;

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  if (!portfolioId) return null;

  const handleCreate = () => {
    if (!newName.trim() || !createTheme) return;
    createTheme.mutate(
      { name: newName.trim(), color: newColor },
      { onSuccess: () => { setNewName(""); setNewColor("#6366f1"); } },
    );
  };

  const startEdit = (t: ThemeBrief) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color ?? "#6366f1");
  };

  const handleUpdate = () => {
    if (!editingId || !updateTheme) return;
    updateTheme.mutate(
      { themeId: editingId, name: editName, color: editColor },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const handleDelete = (themeId: string) => {
    if (!deleteTheme) return;
    deleteTheme.mutate(themeId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Themes</CardTitle>
        <CardDescription>
          Manage investment themes. Each theme gets a dedicated AI research agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-2">
            {(themes ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                {editingId === t.id ? (
                  <>
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border-none p-0"
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUpdate}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div
                      className="h-4 w-4 rounded-full shrink-0"
                      style={{ backgroundColor: t.color ?? "#71717a" }}
                    />
                    <span className="text-sm font-medium flex-1">{t.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.position_count} ETF{t.position_count !== 1 ? "s" : ""}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}

            {(themes ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">
                No themes yet. Create one below or complete onboarding to auto-detect themes.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border-none p-0"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New theme name..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || createTheme?.isPending}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
