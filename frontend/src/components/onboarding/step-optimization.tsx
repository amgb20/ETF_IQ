import { Shield, RefreshCw, Check, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  AdvisorResponse,
  PairRanking,
  ReplacementSuggestion,
  ResolutionChoice,
  DraftETF,
} from "@/types/onboarding";

interface StepOptimizationProps {
  advisor: AdvisorResponse | null;
  isLoading: boolean;
  resolutions: Map<string, ResolutionChoice>;
  setResolutions: React.Dispatch<React.SetStateAction<Map<string, ResolutionChoice>>>;
  etfs: DraftETF[];
  onNext: () => void;
}

function pairKey(ranking: PairRanking): string {
  return ranking.pair_etf_ids.sort().join(":");
}

function OptimizationSkeletons() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StepOptimization({
  advisor,
  isLoading,
  resolutions,
  setResolutions,
  etfs,
  onNext,
}: StepOptimizationProps) {
  if (isLoading || !advisor) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            AI Agents Analyzing...
          </h2>
          <p className="text-sm text-muted-foreground">
            Two agents are evaluating your correlated pairs and finding alternatives.
          </p>
        </div>
        <OptimizationSkeletons />
      </div>
    );
  }

  const { rankings, replacements } = advisor;

  // Build a map of discard_etf_id → replacement
  const replacementMap = new Map<string, ReplacementSuggestion>();
  for (const r of replacements) {
    replacementMap.set(r.discard_etf_id, r);
  }

  const allResolved = rankings.every((r) => resolutions.has(pairKey(r)));

  const setResolution = (ranking: PairRanking, choice: ResolutionChoice) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(pairKey(ranking), choice);
      return next;
    });
  };

  const etfMap = new Map(etfs.map((e) => [e.id, e]));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2
          className="text-xl font-semibold"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Resolve Conflicts
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose how to handle each correlated pair. All conflicts must be resolved to proceed.
        </p>
      </div>

      {rankings.map((ranking) => {
        const pk = pairKey(ranking);
        const resolved = resolutions.get(pk);
        const winner = ranking.ranked_etfs[0];
        const loser = ranking.ranked_etfs[1];
        const replacement = loser ? replacementMap.get(loser.etf_id) : undefined;
        const topSuggestion = replacement?.suggested_etfs[0];

        const winnerDraft = etfMap.get(winner?.etf_id);
        const loserDraft = etfMap.get(loser?.etf_id);

        return (
          <Card
            key={pk}
            className={cn(
              "transition-opacity duration-300",
              resolved && "opacity-60"
            )}
          >
            <CardContent className="p-6 space-y-5">
              {/* Pair header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{winnerDraft?.ticker_yf || winner?.isin}</Badge>
                  <span className="text-muted-foreground">vs</span>
                  <Badge variant="secondary">{loserDraft?.ticker_yf || loser?.isin}</Badge>
                </div>
                {resolved && (
                  <div className="flex items-center gap-1 text-xs text-positive">
                    <Check className="h-3.5 w-3.5" /> Resolved
                  </div>
                )}
              </div>

              {/* Two-column agent recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Agent 1: Best Pick Evaluator */}
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs tracking-wider uppercase text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" /> Best Pick Evaluator
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      Recommends: {winner?.name}
                    </p>
                    {winner?.score_breakdown && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(winner.score_breakdown).map(([key, val]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                            <span>{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {ranking.reasoning.slice(0, 200)}
                    {ranking.reasoning.length > 200 && "..."}
                  </p>

                  <Button
                    variant={resolved?.type === "keep_winner" ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setResolution(ranking, {
                        type: "keep_winner",
                        winner_etf_id: winner.etf_id,
                      })
                    }
                  >
                    Keep {winnerDraft?.ticker_yf || winner?.isin} Only
                  </Button>
                </div>

                {/* Agent 2: Theme Replacement */}
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs tracking-wider uppercase text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5" /> Theme Replacement
                  </div>

                  {topSuggestion ? (
                    <>
                      <div>
                        <p className="text-sm font-medium">
                          Swap {loserDraft?.ticker_yf || loser?.isin} for:
                        </p>
                        <div className="mt-2 rounded-md bg-secondary/50 p-2.5 space-y-1">
                          <p className="text-sm font-medium">{topSuggestion.name}</p>
                          <p className="text-xs text-muted-foreground">{topSuggestion.isin}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {topSuggestion.why}
                          </p>
                          {(topSuggestion.ter !== null || topSuggestion.vol_1y !== null) && (
                            <div className="flex gap-3 text-xs mt-1">
                              {topSuggestion.ter !== null && (
                                <span>TER: {(topSuggestion.ter * 100).toFixed(2)}%</span>
                              )}
                              {topSuggestion.vol_1y !== null && (
                                <span>Vol 1Y: {topSuggestion.vol_1y}%</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {replacement?.reasoning && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {replacement.reasoning.slice(0, 200)}
                          {replacement.reasoning.length > 200 && "..."}
                        </p>
                      )}

                      <Button
                        variant={resolved?.type === "keep_and_replace" ? "default" : "outline"}
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          setResolution(ranking, {
                            type: "keep_and_replace",
                            winner_etf_id: winner.etf_id,
                            replacement: topSuggestion,
                          })
                        }
                      >
                        Keep {winnerDraft?.ticker_yf || winner?.isin} & Add{" "}
                        {topSuggestion.isin.slice(0, 8)}
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No replacement suggestions available for this pair.
                    </p>
                  )}
                </div>
              </div>

              {/* Fallback: keep both */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full text-muted-foreground",
                  resolved?.type === "keep_both" && "text-primary"
                )}
                onClick={() => setResolution(ranking, { type: "keep_both" })}
              >
                Ignore agents & keep both
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!allResolved}>
          Finalize Portfolio <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
