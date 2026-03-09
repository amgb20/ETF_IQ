import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPct } from "@/lib/utils";
import { useAgentScores } from "@/hooks/use-agent-scores";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  totalValue: number | null | undefined;
  pnlPct: number | null | undefined;
  loading?: boolean;
  portfolioId?: string;
}

export function HealthSummary({ totalValue, pnlPct, loading, portfolioId }: Props) {
  const { data: scores } = useAgentScores(portfolioId, 4);

  const { average, breakdown } = useMemo(() => {
    if (!scores?.length) return { average: null, breakdown: [] as { agent: string; avg: number }[] };

    const byAgent: Record<string, number[]> = {};
    for (const s of scores) {
      if (!byAgent[s.agent_name]) byAgent[s.agent_name] = [];
      byAgent[s.agent_name].push(s.score);
    }

    const agentAvgs: { agent: string; avg: number }[] = [];
    let totalScore = 0;
    let count = 0;
    for (const [agent, vals] of Object.entries(byAgent)) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      agentAvgs.push({ agent, avg });
      totalScore += avg;
      count++;
    }

    return {
      average: count > 0 ? totalScore / count : null,
      breakdown: agentAvgs,
    };
  }, [scores]);

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  const confidenceColor =
    average == null
      ? "text-muted-foreground"
      : average >= 7
        ? "text-green-400"
        : average >= 5
          ? "text-amber-400"
          : "text-red-400";

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-6 p-4">
        <div>
          <p className="text-sm text-muted-foreground">Portfolio Value</p>
          <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">P&L</p>
          <p className="text-lg font-semibold">
            <Badge variant={pnlPct != null && pnlPct >= 0 ? "positive" : "negative"}>
              {formatPct(pnlPct)}
            </Badge>
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">System Confidence</p>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <p className={`text-lg font-semibold cursor-help ${confidenceColor}`}>
                  {average != null ? `${average.toFixed(1)} / 10` : "— / 10"}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {breakdown.length > 0 ? (
                  <div className="space-y-1 text-xs">
                    <p className="font-medium mb-1">Agent breakdown (4-week avg):</p>
                    {breakdown.map((b) => (
                      <div key={b.agent} className="flex justify-between gap-4">
                        <span>{b.agent}</span>
                        <span
                          className={
                            b.avg >= 7 ? "text-green-400" : b.avg >= 5 ? "text-amber-400" : "text-red-400"
                          }
                        >
                          {b.avg.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs">No scores yet — agents need to run first</p>
                )}
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Next Agent Run</p>
          <p className="text-sm font-medium">Monday 08:00 UTC</p>
        </div>
      </CardContent>
    </Card>
  );
}
