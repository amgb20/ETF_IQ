import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgentScores, useAgentOutputs } from "@/hooks/use-agent-scores";

interface Props {
  portfolioId: string | undefined;
}

const RESEARCH_AGENTS = [
  "ai_stack_analyst",
  "gold_analyst",
  "defence_analyst",
  "macro_analyst",
];

const AGENT_LABELS: Record<string, string> = {
  ai_stack_analyst: "AI Stack",
  gold_analyst: "Gold",
  defence_analyst: "Defence",
  macro_analyst: "Macro",
};

function scoreColor(score: number): string {
  if (score >= 7) return "bg-green-500/20 text-green-700 dark:text-green-400";
  if (score >= 4) return "bg-amber-500/20 text-amber-700 dark:text-amber-400";
  return "bg-red-500/20 text-red-700 dark:text-red-400";
}

function confidenceColor(c: number): string {
  if (c >= 8) return "bg-green-500/20 text-green-700 dark:text-green-400";
  if (c >= 5) return "bg-amber-500/20 text-amber-700 dark:text-amber-400";
  return "bg-zinc-500/20 text-zinc-500";
}

export function AgentMemoryExplorer({ portfolioId }: Props) {
  const { data: scores } = useAgentScores(portfolioId, 8);
  const { data: outputs } = useAgentOutputs(portfolioId, undefined, 8);

  const { weeks, grid } = useMemo(() => {
    if (!scores || scores.length === 0) return { weeks: [] as string[], grid: {} as Record<string, Record<string, number>> };

    const allDates = [...new Set(scores.map((s) => s.run_date))].sort();
    const latestWeeks = allDates.slice(-8);

    const g: Record<string, Record<string, number>> = {};
    for (const agent of RESEARCH_AGENTS) {
      g[agent] = {};
    }
    for (const s of scores) {
      if (RESEARCH_AGENTS.includes(s.agent_name) && latestWeeks.includes(s.run_date)) {
        g[s.agent_name][s.run_date] = s.score;
      }
    }
    return { weeks: latestWeeks, grid: g };
  }, [scores]);

  const latestPredictions = useMemo(() => {
    if (!outputs?.length) return {} as Record<string, { prediction: string; confidence: number; timeframe: string }[]>;

    const map: Record<string, typeof outputs[0]> = {};
    for (const o of outputs) {
      if (RESEARCH_AGENTS.includes(o.agent_name)) {
        if (!map[o.agent_name] || o.run_date > map[o.agent_name].run_date) {
          map[o.agent_name] = o;
        }
      }
    }

    const result: Record<string, { prediction: string; confidence: number; timeframe: string }[]> = {};
    for (const [agent, output] of Object.entries(map)) {
      if (output.predictions && Array.isArray(output.predictions)) {
        result[agent] = output.predictions.slice(0, 3).map((p) => ({
          prediction: String(p.prediction ?? ""),
          confidence: Number(p.confidence ?? 0),
          timeframe: String(p.timeframe ?? ""),
        }));
      }
    }
    return result;
  }, [outputs]);

  const hasScores = weeks.length > 0;
  const hasOutputs = outputs != null && outputs.length > 0;
  const hasPredictions = Object.keys(latestPredictions).length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Agent Memory Explorer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground py-2 pr-4 w-36">Agent</th>
                {hasScores
                  ? weeks.map((w) => (
                      <th key={w} className="text-center font-medium text-muted-foreground py-2 px-2 w-20 text-xs">
                        {w}
                      </th>
                    ))
                  : Array.from({ length: 8 }, (_, i) => (
                      <th key={i} className="text-center font-medium text-muted-foreground py-2 px-2 w-16">
                        W{i + 1}
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody>
              {RESEARCH_AGENTS.map((agent) => (
                <tr key={agent} className="border-t border-border">
                  <td className="py-2 pr-4 text-xs font-medium">{AGENT_LABELS[agent] ?? agent}</td>
                  {hasScores
                    ? weeks.map((w) => {
                        const score = grid[agent]?.[w];
                        return (
                          <td key={w} className="py-2 px-2 text-center">
                            {score != null ? (
                              <span className={`inline-flex h-7 w-full items-center justify-center rounded text-xs font-semibold ${scoreColor(score)}`}>
                                {score.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">&mdash;</span>
                            )}
                          </td>
                        );
                      })
                    : Array.from({ length: 8 }, (_, i) => (
                        <td key={i} className="py-2 px-2 text-center">
                          <span className="text-xs text-muted-foreground">&mdash;</span>
                        </td>
                      ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!hasScores && hasOutputs && (
          <p className="text-xs text-muted-foreground text-center italic">
            Accuracy scores will appear after the second report &mdash; the Judge needs a prior run to evaluate.
          </p>
        )}
        {!hasScores && !hasOutputs && (
          <p className="text-xs text-muted-foreground text-center italic">
            Scores will appear here once the agent cycle has run
          </p>
        )}

        {/* Latest predictions per agent */}
        {hasPredictions && (
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Latest Predictions</h4>
            {RESEARCH_AGENTS.map((agent) => {
              const preds = latestPredictions[agent];
              if (!preds?.length) return null;
              return (
                <div key={agent} className="space-y-1.5">
                  <p className="text-xs font-medium">{AGENT_LABELS[agent] ?? agent}</p>
                  {preds.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 pl-3">
                      <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 ${confidenceColor(p.confidence)}`}>
                        {p.confidence}/10
                      </Badge>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {p.prediction}
                        {p.timeframe && (
                          <span className="ml-1 text-[10px] opacity-60">({p.timeframe})</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
