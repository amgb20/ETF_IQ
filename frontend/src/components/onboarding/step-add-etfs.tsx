import { useState } from "react";
import { Search, Plus, X, Loader2, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useETFDiscover } from "@/hooks/use-etf-search";
import type { DraftETF } from "@/types/onboarding";

interface StepAddEtfsProps {
  etfs: DraftETF[];
  setEtfs: React.Dispatch<React.SetStateAction<DraftETF[]>>;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function StepAddEtfs({ etfs, setEtfs, onAnalyze, isAnalyzing }: StepAddEtfsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults, isLoading: searching } = useETFDiscover(searchQuery);

  const addETF = (etf: { id: string; isin: string; name: string; ticker_yf: string | null }) => {
    if (etfs.some((e) => e.isin === etf.isin)) return;
    setEtfs((prev) => [...prev, { id: etf.id, isin: etf.isin, name: etf.name, ticker_yf: etf.ticker_yf }]);
    setSearchQuery("");
  };

  const removeETF = (isin: string) => setEtfs((prev) => prev.filter((e) => e.isin !== isin));

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
              placeholder="Search all ETFs by name, ISIN, or ticker..."
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

          {searchQuery.length >= 2 && !searching && searchResults?.length === 0 && (
            <p className="text-sm text-muted-foreground">No ETFs found. Try a different name, ISIN, or ticker.</p>
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
