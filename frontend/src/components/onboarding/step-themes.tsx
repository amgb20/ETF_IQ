import { Bot, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ThemeClassification, DraftETF } from "@/types/onboarding";

interface StepThemesProps {
  themes: ThemeClassification[];
  etfs: DraftETF[];
  isLoading: boolean;
  onNext: () => void;
  isLoadingNext: boolean;
}

function ThemeSkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StepThemes({ themes, etfs, isLoading, onNext, isLoadingNext }: StepThemesProps) {
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Detecting Investment Themes...
          </h2>
          <p className="text-sm text-muted-foreground">
            Our AI is analyzing your ETFs to identify coherent investment themes.
          </p>
        </div>
        <ThemeSkeletons />
      </div>
    );
  }

  const etfMap = new Map(etfs.map((e) => [e.id, e]));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2
          className="text-xl font-semibold"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Themes Detected
        </h2>
        <p className="text-sm text-muted-foreground">
          {themes.length} theme{themes.length !== 1 ? "s" : ""} identified from your{" "}
          {etfs.length} ETFs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {themes.map((theme) => (
          <Card key={theme.label} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: theme.color }} />
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3
                  className="text-lg font-semibold"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {theme.label}
                </h3>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: theme.color }}
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {theme.etf_ids.map((eid) => {
                  const etf = etfMap.get(eid);
                  return (
                    <Badge
                      key={eid}
                      variant="secondary"
                      className="text-xs"
                      style={{
                        borderColor: theme.color + "40",
                        backgroundColor: theme.color + "15",
                      }}
                    >
                      {etf?.ticker_yf || etf?.name?.slice(0, 15) || eid.slice(0, 8)}
                    </Badge>
                  );
                })}
              </div>

              {theme.research_agent && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground tracking-wider uppercase">
                  <Bot className="h-3 w-3" />
                  Agent: {theme.research_agent}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Themes detected by AI — you can adjust later from your dashboard.
      </p>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={isLoadingNext}>
          {isLoadingNext ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Checking Correlations...
            </>
          ) : (
            <>
              Check Correlations <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
