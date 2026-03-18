import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AllocationEntry } from "@/types/onboarding";

interface StepAllocationsProps {
  allocations: AllocationEntry[];
  setAllocations: React.Dispatch<React.SetStateAction<AllocationEntry[]>>;
  portfolioName: string;
  setPortfolioName: React.Dispatch<React.SetStateAction<string>>;
  onNext: () => void;
}

export function StepAllocations({
  allocations,
  setAllocations,
  portfolioName,
  setPortfolioName,
  onNext,
}: StepAllocationsProps) {
  const updateAllocation = (isin: string, updates: Partial<AllocationEntry>) => {
    setAllocations((prev) =>
      prev.map((a) => (a.isin === isin ? { ...a, ...updates } : a))
    );
  };

  const totalWeight = allocations
    .filter((a) => a.mode === "weight")
    .reduce((sum, a) => sum + a.target_weight, 0);

  const weightStatus =
    totalWeight === 0
      ? "empty"
      : Math.abs(totalWeight - 100) < 0.01
        ? "balanced"
        : "unbalanced";

  const canProceed =
    portfolioName.trim().length > 0 &&
    allocations.every(
      (a) =>
        a.mode === "weight"
          ? a.target_weight > 0
          : a.shares > 0 && a.entry_price > 0
    );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2
          className="text-xl font-semibold"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Set Allocations
        </h2>
        <p className="text-sm text-muted-foreground">
          Set a target weight or enter your existing positions.
        </p>
      </div>

      {/* Portfolio name */}
      <Card>
        <CardContent className="p-5">
          <label className="text-xs tracking-wider uppercase text-muted-foreground block mb-2">
            Portfolio Name
          </label>
          <input
            type="text"
            value={portfolioName}
            onChange={(e) => setPortfolioName(e.target.value)}
            placeholder="My ETF Portfolio"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-colors"
          />
        </CardContent>
      </Card>

      {/* ETF allocation rows */}
      <div className="space-y-3">
        {allocations.map((alloc) => (
          <Card key={alloc.isin}>
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {alloc.ticker_yf || alloc.name.slice(0, 25)}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px]"
                    style={{
                      borderColor: alloc.theme_color + "40",
                      backgroundColor: alloc.theme_color + "15",
                    }}
                  >
                    {alloc.theme_label}
                  </Badge>
                </div>

                {/* Mode toggle */}
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    className={cn(
                      "px-3 py-1 text-xs transition-colors",
                      alloc.mode === "weight"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => updateAllocation(alloc.isin, { mode: "weight" })}
                  >
                    Target %
                  </button>
                  <button
                    className={cn(
                      "px-3 py-1 text-xs transition-colors",
                      alloc.mode === "owned"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => updateAllocation(alloc.isin, { mode: "owned" })}
                  >
                    Owned
                  </button>
                </div>
              </div>

              {/* Weight mode */}
              {alloc.mode === "weight" && (
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={alloc.target_weight}
                    onChange={(e) =>
                      updateAllocation(alloc.isin, {
                        target_weight: parseFloat(e.target.value),
                      })
                    }
                    className="flex-1 accent-primary"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={alloc.target_weight || ""}
                      onChange={(e) =>
                        updateAllocation(alloc.isin, {
                          target_weight: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              )}

              {/* Owned mode */}
              {alloc.mode === "owned" && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Shares</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={alloc.shares || ""}
                      onChange={(e) =>
                        updateAllocation(alloc.isin, {
                          shares: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Avg Price (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={alloc.entry_price || ""}
                      onChange={(e) =>
                        updateAllocation(alloc.isin, {
                          entry_price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Purchase Date</label>
                    <input
                      type="date"
                      value={alloc.entry_date}
                      onChange={(e) =>
                        updateAllocation(alloc.isin, { entry_date: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sticky footer with total */}
      <div
        className={cn(
          "sticky bottom-0 bg-background/90 backdrop-blur-sm border-t border-border py-4 px-4 -mx-4 flex items-center justify-between",
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs tracking-wider uppercase text-muted-foreground">
            Target Weight Total:
          </span>
          <span
            className={cn(
              "text-sm font-medium",
              weightStatus === "balanced" && "text-positive",
              weightStatus === "unbalanced" && "text-warning",
              weightStatus === "empty" && "text-muted-foreground"
            )}
          >
            {totalWeight.toFixed(1)}%
            {weightStatus === "balanced" && " ✓"}
            {weightStatus === "unbalanced" && " — Adjust to reach 100%"}
          </span>
        </div>

        <Button onClick={onNext} disabled={!canProceed}>
          Review <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
