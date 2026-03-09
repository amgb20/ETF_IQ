import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAgentScores } from "@/hooks/use-agent-scores";

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

export function AgentMemoryExplorer({ portfolioId }: Props) {
  const { data: scores } = useAgentScores(portfolioId, 8);

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

  const hasData = weeks.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Agent Memory Explorer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground py-2 pr-4 w-36">Agent</th>
                {hasData
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
                  {hasData
                    ? weeks.map((w) => {
                        const score = grid[agent]?.[w];
                        return (
                          <td key={w} className="py-2 px-2 text-center">
                            {score != null ? (
                              <span className={`inline-flex h-7 w-full items-center justify-center rounded text-xs font-semibold ${scoreColor(score)}`}>
                                {score.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })
                    : Array.from({ length: 8 }, (_, i) => (
                        <td key={i} className="py-2 px-2 text-center">
                          <span className="text-xs text-muted-foreground">—</span>
                        </td>
                      ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasData && (
          <p className="text-xs text-muted-foreground text-center mt-3 italic">
            Scores will appear here once the agent cycle has run
          </p>
        )}
      </CardContent>
    </Card>
  );
}
