import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUser } from "@/hooks/use-user";
import { useUpdatePreferences } from "@/hooks/use-update-preferences";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";

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
    </div>
  );
}
