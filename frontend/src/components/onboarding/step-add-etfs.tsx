import { useState } from "react";
import { Search, Plus, X, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useETFSearch } from "@/hooks/use-etf-search";
import type { DraftETF } from "@/types/onboarding";

// Demo ETFs — ISINs that are likely in the DB for testing
const DEMO_ETFS: DraftETF[] = [
  { id: "", isin: "IE00B4L5Y983", name: "iShares Core MSCI World", ticker_yf: "IWDA.L" },
  { id: "", isin: "IE00B4L5YC18", name: "iShares MSCI EM", ticker_yf: "IEMA.L" },
  { id: "", isin: "IE00B579F325", name: "Invesco Physical Gold", ticker_yf: "SGLD.L" },
  { id: "", isin: "IE00BFMXXD54", name: "Vanguard S&P 500", ticker_yf: "VUSA.L" },
  { id: "", isin: "IE00BGL86Z12", name: "iShares Automation & Robotics", ticker_yf: "RBOT.L" },
];

interface StepAddEtfsProps {
  etfs: DraftETF[];
  setEtfs: React.Dispatch<React.SetStateAction<DraftETF[]>>;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function StepAddEtfs({ etfs, setEtfs, onAnalyze, isAnalyzing }: StepAddEtfsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults, isLoading: searching } = useETFSearch(searchQuery);

  const addETF = (etf: { id: string; isin: string; name: string; ticker_yf: string | null }) => {
    if (etfs.some((e) => e.isin === etf.isin)) return;
    setEtfs((prev) => [...prev, { id: etf.id, isin: etf.isin, name: etf.name, ticker_yf: etf.ticker_yf }]);
    setSearchQuery("");
  };

  const removeETF = (isin: string) => setEtfs((prev) => prev.filter((e) => e.isin !== isin));

  const loadDemo = () => {
    const newEtfs = DEMO_ETFS.filter((d) => !etfs.some((e) => e.isin === d.isin));
    setEtfs((prev) => [...prev, ...newEtfs]);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Add Your ETFs</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Search and add all the ETFs you're interested in tracking.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ISIN, or ticker..."
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-colors"
            />
          </div>

          {/* Search results */}
          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          )}

          {searchResults && searchResults.length > 0 && (
            <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
              {searchResults.map((etf) => (
                <button
                  key={etf.isin}
                  onClick={() => addETF(etf)}
                  disabled={etfs.some((e) => e.isin === etf.isin)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-secondary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="text-left">
                    <p className="font-medium">{etf.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {etf.isin} {etf.ticker_yf ? `(${etf.ticker_yf})` : ""}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                </button>
              ))}
            </div>
          )}

          {/* Selected ETFs as pill badges */}
          {etfs.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase text-muted-foreground">
                Selected ({etfs.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {etfs.map((etf) => (
                  <Badge
                    key={etf.isin}
                    variant="secondary"
                    className="pl-3 pr-1.5 py-1.5 gap-1.5 text-sm"
                  >
                    <span>{etf.ticker_yf || etf.name.slice(0, 20)}</span>
                    <button
                      onClick={() => removeETF(etf.isin)}
                      className="h-4 w-4 rounded-full hover:bg-foreground/10 flex items-center justify-center transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Demo portfolio link */}
          {etfs.length === 0 && (
            <button
              onClick={loadDemo}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" /> Load demo portfolio for testing
            </button>
          )}
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex justify-end">
        <Button onClick={onAnalyze} disabled={etfs.length === 0 || isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              Analyze Themes <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
