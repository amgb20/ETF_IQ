import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "@/contexts/UserContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, X, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useCreatePortfolio } from "@/hooks/use-portfolios";
import { useETFSearch } from "@/hooks/use-etf-search";
import { apiFetch } from "@/lib/api-client";

interface DraftETF {
  id: string;
  isin: string;
  name: string;
  ticker_yf: string | null;
  shares: number;
  entry_price: number;
  entry_date: string;
  target_allocation: number;
  theme: string;
}

const THEME_COLORS: Record<string, string> = {
  "AI Stack": "#6366f1",
  Gold: "#f59e0b",
  Defence: "#ef4444",
  Other: "#71717a",
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useUserContext();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [etfs, setEtfs] = useState<DraftETF[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const createPortfolio = useCreatePortfolio();
  const { data: searchResults, isLoading: searching } = useETFSearch(searchQuery);

  const addETF = (etf: { id: string; isin: string; name: string; ticker_yf: string | null }) => {
    if (etfs.some((e) => e.isin === etf.isin)) return;
    setEtfs((prev) => [
      ...prev,
      {
        ...etf,
        shares: 0,
        entry_price: 0,
        entry_date: new Date().toISOString().split("T")[0],
        target_allocation: 0,
        theme: "Other",
      },
    ]);
    setSearchQuery("");
  };

  const removeETF = (isin: string) => setEtfs((prev) => prev.filter((e) => e.isin !== isin));

  const updateETF = (isin: string, field: keyof DraftETF, value: string | number) => {
    setEtfs((prev) => prev.map((e) => (e.isin === isin ? { ...e, [field]: value } : e)));
  };

  const handleCreate = async () => {
    if (!name.trim() || etfs.length === 0) return;
    setCreating(true);
    try {
      const portfolio = await createPortfolio.mutateAsync({ name, description });
      for (const etf of etfs) {
        const invested = etf.shares * etf.entry_price;
        await apiFetch(`/portfolios/${portfolio.id}/positions`, {
          method: "POST",
          body: JSON.stringify({
            etf_id: etf.id,
            entry_date: etf.entry_date,
            entry_price: etf.entry_price,
            shares: etf.shares,
            invested_amount: invested,
            target_allocation: etf.target_allocation || null,
            layer_label: etf.theme,
          }),
        });
      }
      navigate(`/${user?.id}/dashboard`);
    } catch (err) {
      console.error("Onboarding failed:", err);
    } finally {
      setCreating(false);
    }
  };

  const themes = [...new Set(etfs.map((e) => e.theme))];
  const canProceed =
    step === 1 ? name.trim().length > 0 :
    step === 2 ? etfs.length > 0 :
    step === 3 ? true :
    step === 4 ? etfs.every((e) => e.shares > 0 && e.entry_price > 0) :
    true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome to PortfolioIQ</h1>
          <p className="text-muted-foreground mt-1">Let's set up your portfolio</p>
        </div>

        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-2 w-12 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Name Your Portfolio</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Portfolio Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My ETF Portfolio"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="European tech-focused ETF portfolio..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-20 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Add ETFs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or ISIN..."
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
                />
              </div>

              {searching && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching...</div>}

              {searchResults && searchResults.length > 0 && (
                <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                  {searchResults.map((etf) => (
                    <button
                      key={etf.isin}
                      onClick={() => addETF(etf)}
                      disabled={etfs.some((e) => e.isin === etf.isin)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-left">
                        <p className="font-medium">{etf.name}</p>
                        <p className="text-xs text-muted-foreground">{etf.isin} {etf.ticker_yf ? `(${etf.ticker_yf})` : ""}</p>
                      </div>
                      <Plus className="h-4 w-4 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {etfs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selected ETFs ({etfs.length})</p>
                  {etfs.map((etf) => (
                    <div key={etf.isin} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{etf.name}</p>
                        <p className="text-xs text-muted-foreground">{etf.isin}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeETF(etf.isin)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Assign Themes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {etfs.map((etf) => (
                <div key={etf.isin} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{etf.name}</p>
                  </div>
                  <select
                    value={etf.theme}
                    onChange={(e) => updateETF(etf.isin, "theme", e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    {Object.keys(THEME_COLORS).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Position Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {etfs.map((etf) => (
                <div key={etf.isin} className="rounded-md border border-border p-3 space-y-2">
                  <p className="text-sm font-medium">{etf.name} <Badge variant="secondary" className="ml-1 text-[10px]">{etf.theme}</Badge></p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Shares</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={etf.shares || ""}
                        onChange={(e) => updateETF(etf.isin, "shares", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Entry Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={etf.entry_price || ""}
                        onChange={(e) => updateETF(etf.isin, "entry_price", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Entry Date</label>
                      <input
                        type="date"
                        value={etf.entry_date}
                        onChange={(e) => updateETF(etf.isin, "entry_date", e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Target %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={etf.target_allocation || ""}
                        onChange={(e) => updateETF(etf.isin, "target_allocation", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader><CardTitle>Confirm & Create</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Portfolio</p>
                <p className="font-medium">{name}</p>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Positions ({etfs.length})</p>
                {etfs.map((etf) => (
                  <div key={etf.isin} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                    <span>{etf.name}</span>
                    <span className="text-muted-foreground">
                      {etf.shares} shares @ {etf.entry_price} | {etf.theme}
                    </span>
                  </div>
                ))}
              </div>
              {themes.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {themes.map((t) => (
                    <Badge key={t} style={{ backgroundColor: THEME_COLORS[t] || "#71717a" }} className="text-white text-xs">
                      {t}: {etfs.filter((e) => e.theme === t).length} ETFs
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : (
            <div />
          )}
          {step < 5 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Create Portfolio
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
