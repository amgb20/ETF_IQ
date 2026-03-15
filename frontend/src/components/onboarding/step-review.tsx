import { Loader2, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AllocationEntry, ThemeClassification } from "@/types/onboarding";

interface StepReviewProps {
  allocations: AllocationEntry[];
  themes: ThemeClassification[];
  portfolioName: string;
  onComplete: () => void;
  isSubmitting: boolean;
}

export function StepReview({
  allocations,
  themes,
  portfolioName,
  onComplete,
  isSubmitting,
}: StepReviewProps) {
  // Group allocations by theme
  const grouped = new Map<string, AllocationEntry[]>();
  for (const alloc of allocations) {
    const key = alloc.theme_label;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(alloc);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2
          className="text-2xl font-semibold"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Review Your Portfolio
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{portfolioName}</span> —{" "}
          {allocations.length} ETF{allocations.length !== 1 ? "s" : ""} across{" "}
          {grouped.size} theme{grouped.size !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Theme cards */}
      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([themeName, themeAllocs]) => {
          const theme = themes.find((t) => t.label === themeName);
          const color = theme?.color || themeAllocs[0]?.theme_color || "#71717a";

          return (
            <Card key={themeName} className="overflow-hidden">
              <div className="h-1" style={{ backgroundColor: color }} />
              <CardContent className="p-5 space-y-3">
                <h3
                  className="text-lg font-semibold"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {themeName}
                </h3>

                <div className="divide-y divide-border">
                  {themeAllocs.map((alloc) => (
                    <div
                      key={alloc.isin}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          style={{
                            borderColor: color + "40",
                            backgroundColor: color + "15",
                          }}
                        >
                          {alloc.ticker_yf || alloc.isin}
                        </Badge>
                        <span className="text-sm text-muted-foreground hidden sm:inline">
                          {alloc.name.length > 30
                            ? alloc.name.slice(0, 30) + "..."
                            : alloc.name}
                        </span>
                      </div>

                      <span className="text-sm font-medium">
                        {alloc.mode === "weight" ? (
                          <>{alloc.target_weight}%</>
                        ) : (
                          <>
                            {alloc.shares} shs @ €{alloc.entry_price.toFixed(2)}
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={onComplete} disabled={isSubmitting} className="px-8">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating Portfolio...
            </>
          ) : (
            <>
              <LayoutDashboard className="h-4 w-4 mr-1" /> Go to Dashboard
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
