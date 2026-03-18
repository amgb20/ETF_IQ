import { AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CorrelationsResponse } from "@/types/onboarding";

interface StepCorrelationsProps {
  correlations: CorrelationsResponse | null;
  isLoading: boolean;
  onNext: () => void;
  isLoadingNext: boolean;
}

function CorrelationBar({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  const pct = Math.min(Math.round(value * 100), 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function StepCorrelations({
  correlations,
  isLoading,
  onNext,
  isLoadingNext,
}: StepCorrelationsProps) {
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Analyzing Correlations...
          </h2>
          <p className="text-sm text-muted-foreground">
            Computing price correlation and holdings overlap for your ETFs.
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!correlations) return null;

  const { flagged_pairs, price_correlations, holdings_overlaps } = correlations;

  // No issues — clean portfolio
  if (flagged_pairs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-positive/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-positive" />
              </div>
            </div>
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              No High Correlations Found
            </h2>
            <p className="text-sm text-muted-foreground">
              Your ETFs are well diversified — no pairs exceed the 80% correlation threshold.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onNext}>
            Set Allocations <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // Build lookup maps for correlation values
  const priceMap = new Map<string, number>();
  for (const pc of price_correlations) {
    priceMap.set(`${pc.etf_id_a}:${pc.etf_id_b}`, pc.correlation);
    priceMap.set(`${pc.etf_id_b}:${pc.etf_id_a}`, pc.correlation);
  }
  const overlapMap = new Map<string, number>();
  for (const ho of holdings_overlaps) {
    overlapMap.set(`${ho.etf_id_a}:${ho.etf_id_b}`, ho.overlap_pct / 100);
    overlapMap.set(`${ho.etf_id_b}:${ho.etf_id_a}`, ho.overlap_pct / 100);
  }

  // Deduplicate flagged pairs by ETF pair
  const seen = new Set<string>();
  const uniquePairs = flagged_pairs.filter((fp) => {
    const key = [fp.etf_id_a, fp.etf_id_b].sort().join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Warning banner */}
      <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
        <div>
          <p className="text-sm font-medium">High Correlation Detected</p>
          <p className="text-xs text-muted-foreground">
            {uniquePairs.length} pair{uniquePairs.length !== 1 ? "s" : ""} of ETFs share
            significant overlap. Consider optimizing.
          </p>
        </div>
      </div>

      {/* Flagged pair cards */}
      <div className="space-y-4">
        {uniquePairs.map((fp) => {
          const priceCorr = priceMap.get(`${fp.etf_id_a}:${fp.etf_id_b}`) ?? 0;
          const holdingsOvl = overlapMap.get(`${fp.etf_id_a}:${fp.etf_id_b}`) ?? 0;

          return (
            <Card key={`${fp.etf_id_a}:${fp.etf_id_b}`}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className="font-medium">{fp.isin_a}</span>
                  <span className="text-muted-foreground">↔</span>
                  <span className="font-medium">{fp.isin_b}</span>
                </div>

                <CorrelationBar
                  label="Price Correlation (1Y)"
                  value={priceCorr}
                  colorClass="bg-negative"
                />
                <CorrelationBar
                  label="Holdings Overlap"
                  value={holdingsOvl}
                  colorClass="bg-warning"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={isLoadingNext}>
          {isLoadingNext ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Consulting Agents...
            </>
          ) : (
            <>
              Optimize Portfolio <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
