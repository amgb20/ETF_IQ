import { AlertTriangle, CheckCircle, ArrowRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CorrelationsResponse, PairOverlap, PairCorrelation } from "@/types/onboarding";

const FLAG_THRESHOLD = 80;

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
  flagged,
}: {
  label: string;
  value: number;
  colorClass: string;
  flagged?: boolean;
}) {
  const pct = Math.min(Math.round(value * 100), 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${flagged ? "text-warning" : ""}`}>
          {pct}%{flagged && " ⚠"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PairCard({
  overlap,
  priceCorr,
  isFlagged,
}: {
  overlap: PairOverlap;
  priceCorr: number | null;
  isFlagged: boolean;
}) {
  const overlapFraction = overlap.overlap_pct / 100;
  const priceFraction = priceCorr ?? 0;

  return (
    <Card className={isFlagged ? "border-warning/40" : ""}>
      <CardContent className="p-5 space-y-4">
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="font-medium truncate max-w-[45%]" title={overlap.name_a}>
              {overlap.name_a}
            </span>
            <span className="text-muted-foreground shrink-0">↔</span>
            <span className="font-medium truncate max-w-[45%]" title={overlap.name_b}>
              {overlap.name_b}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {overlap.isin_a} / {overlap.isin_b}
          </p>
        </div>

        <CorrelationBar
          label="Holdings Overlap"
          value={overlapFraction}
          colorClass={overlapFraction >= 0.7 ? "bg-warning" : "bg-primary/60"}
          flagged={overlap.overlap_pct >= FLAG_THRESHOLD}
        />
        {overlap.shared_holdings_count > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {overlap.shared_holdings_count} shared holding{overlap.shared_holdings_count !== 1 ? "s" : ""}
          </p>
        )}

        {priceCorr !== null && (
          <CorrelationBar
            label="Price Correlation (1Y)"
            value={priceFraction}
            colorClass={priceFraction >= 0.8 ? "bg-negative" : "bg-primary/60"}
            flagged={priceFraction >= 0.8}
          />
        )}
      </CardContent>
    </Card>
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

  const priceMap = new Map<string, number>();
  for (const pc of price_correlations) {
    priceMap.set(`${pc.etf_id_a}:${pc.etf_id_b}`, pc.correlation);
    priceMap.set(`${pc.etf_id_b}:${pc.etf_id_a}`, pc.correlation);
  }

  const flaggedKeys = new Set<string>();
  for (const fp of flagged_pairs) {
    flaggedKeys.add([fp.etf_id_a, fp.etf_id_b].sort().join(":"));
  }

  const hasFlaggedPairs = flagged_pairs.length > 0;
  const hasAnyOverlap = holdings_overlaps.some((ho) => ho.overlap_pct > 0);
  const hasAnyData = hasAnyOverlap || price_correlations.length > 0;

  const sortedOverlaps = [...holdings_overlaps].sort(
    (a, b) => b.overlap_pct - a.overlap_pct
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Banner */}
      {hasFlaggedPairs ? (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-medium">High Correlation Detected</p>
            <p className="text-xs text-muted-foreground">
              {flagged_pairs.length} pair{flagged_pairs.length !== 1 ? "s" : ""} exceed
              the {FLAG_THRESHOLD}% threshold. Consider optimizing.
            </p>
          </div>
        </div>
      ) : hasAnyData ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-positive/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-positive" />
              </div>
            </div>
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              No Critical Overlaps
            </h2>
            <p className="text-sm text-muted-foreground">
              No pairs exceed the {FLAG_THRESHOLD}% threshold — your portfolio is reasonably diversified.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Info className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              No Overlap Data Available
            </h2>
            <p className="text-sm text-muted-foreground">
              Holdings or price data is not yet available for your ETFs.
            </p>
          </CardContent>
        </Card>
      )}

      {/* All pair cards — sorted by overlap descending */}
      {sortedOverlaps.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground px-1">
            Pairwise Overlap
          </h3>
          {sortedOverlaps.map((ho) => {
            const pairKey = [ho.etf_id_a, ho.etf_id_b].sort().join(":");
            const priceCorr =
              priceMap.get(`${ho.etf_id_a}:${ho.etf_id_b}`) ?? null;
            return (
              <PairCard
                key={pairKey}
                overlap={ho}
                priceCorr={priceCorr}
                isFlagged={flaggedKeys.has(pairKey)}
              />
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={isLoadingNext}>
          {isLoadingNext ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Consulting Agents...
            </>
          ) : hasFlaggedPairs ? (
            <>
              Optimize Portfolio <ArrowRight className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              Set Allocations <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
