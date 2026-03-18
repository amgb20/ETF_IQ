import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useETFDiscover } from "@/hooks/use-etf-search";
import { useAddPosition } from "@/hooks/use-positions";
import { usePortfolioThemes, type ThemeBrief } from "@/hooks/use-portfolios";

interface DraftETF {
  id: string;
  isin: string;
  name: string;
  ticker_yf: string | null;
  shares: number;
  entry_price: number;
  entry_date: string;
  theme_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  existingIsins: string[];
}

export function AddPositionModal({ open, onOpenChange, portfolioId, existingIsins }: Props) {
  const qc = useQueryClient();
  const addPosition = useAddPosition(portfolioId);
  const { data: themes } = usePortfolioThemes(portfolioId);

  const [step, setStep] = useState<"search" | "details">("search");
  const [drafts, setDrafts] = useState<DraftETF[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: results, isLoading: searching } = useETFDiscover(searchQuery);

  const allExisting = [...existingIsins, ...drafts.map((d) => d.isin)];

  const addETF = (etf: { id: string; isin: string; name: string; ticker_yf: string | null }) => {
    if (allExisting.includes(etf.isin)) return;
    setDrafts((prev) => [
      ...prev,
      {
        ...etf,
        shares: 0,
        entry_price: 0,
        entry_date: new Date().toISOString().split("T")[0],
        theme_id: "",
      },
    ]);
    setSearchQuery("");
  };

  const removeETF = (isin: string) => setDrafts((prev) => prev.filter((d) => d.isin !== isin));

  const updateETF = (isin: string, field: keyof DraftETF, value: string | number) => {
    setDrafts((prev) => prev.map((d) => (d.isin === isin ? { ...d, [field]: value } : d)));
  };

  const canSave = drafts.length > 0 && drafts.every((d) => d.shares > 0 && d.entry_price > 0);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const d of drafts) {
        await addPosition.mutateAsync({
          etf_id: d.id,
          shares: d.shares,
          entry_price: d.entry_price,
          entry_date: d.entry_date,
          invested_amount: d.shares * d.entry_price,
          ...(d.theme_id ? { theme_id: d.theme_id } : {}),
        });
      }
      await qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Failed to add positions");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep("search");
    setDrafts([]);
    setSearchQuery("");
    setError(null);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add ETFs to Portfolio</DialogTitle>
          <DialogDescription>
            {step === "search"
              ? "Search and select ETFs to add."
              : "Enter position details for each ETF."}
          </DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all ETFs by name or ISIN..."
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
                autoFocus
              />
            </div>

            {searching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching...
              </div>
            )}

            {results && results.length > 0 && (
              <div className="border border-border rounded-md divide-y divide-border max-h-40 overflow-y-auto">
                {results.map((etf) => {
                  const already = allExisting.includes(etf.isin);
                  return (
                    <button
                      key={etf.isin}
                      onClick={() => addETF(etf)}
                      disabled={already}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-left">
                        <p className="font-medium">{etf.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {etf.isin} {etf.ticker_yf ? `(${etf.ticker_yf})` : ""}
                        </p>
                      </div>
                      {already ? (
                        <Badge variant="secondary" className="text-[10px]">Added</Badge>
                      ) : (
                        <Plus className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {drafts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Selected ({drafts.length})</p>
                {drafts.map((d) => (
                  <div
                    key={d.isin}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.isin}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeETF(d.isin)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button disabled={drafts.length === 0} onClick={() => setStep("details")}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4">
            {drafts.map((d) => (
              <div key={d.isin} className="rounded-md border border-border p-3 space-y-2">
                <p className="text-sm font-medium">
                  {d.name}{" "}
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {d.isin}
                  </Badge>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Shares</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={d.shares || ""}
                      onChange={(e) => updateETF(d.isin, "shares", parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Entry Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={d.entry_price || ""}
                      onChange={(e) => updateETF(d.isin, "entry_price", parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Entry Date</label>
                    <input
                      type="date"
                      value={d.entry_date}
                      onChange={(e) => updateETF(d.isin, "entry_date", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Theme</label>
                    <select
                      value={d.theme_id}
                      onChange={(e) => updateETF(d.isin, "theme_id", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    >
                      <option value="">Auto-detect</option>
                      {(themes ?? []).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("search")} disabled={saving}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleSave} disabled={!canSave || saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Add {drafts.length} Position{drafts.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
