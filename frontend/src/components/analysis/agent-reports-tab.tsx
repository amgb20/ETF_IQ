import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AGENT_NAMES, CHART_COLORS } from "@/lib/constants";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  Legend,
} from "recharts";
import { useAgentScores, useAgentOutputs } from "@/hooks/use-agent-scores";

interface Props {
  portfolioId?: string;
}

const RESEARCH_AGENTS = [
  "ai_stack_analyst",
  "gold_analyst",
  "defence_analyst",
  "macro_analyst",
];

const AGENT_DISPLAY: Record<string, { label: string; index: number }> = {
  ai_stack_analyst: { label: "AI Stack", index: 0 },
  gold_analyst: { label: "Gold", index: 1 },
  defence_analyst: { label: "Defence", index: 2 },
  macro_analyst: { label: "Macro", index: 3 },
  risk_assessor: { label: "Risk", index: 4 },
  event_mapper: { label: "Events", index: 5 },
  action_recommender: { label: "Recommender", index: 6 },
  judge: { label: "Judge", index: 7 },
};

export function AgentReportsTab({ portfolioId }: Props) {
  const { data: scores } = useAgentScores(portfolioId);
  const { data: outputs } = useAgentOutputs(portfolioId);

  const chartData = useMemo(() => {
    if (!scores?.length) return [];
    const byDate: Record<string, Record<string, number>> = {};
    for (const s of scores) {
      if (!byDate[s.run_date]) byDate[s.run_date] = {};
      byDate[s.run_date][s.agent_name] = s.score;
    }
    return Object.entries(byDate)
      .map(([week, agents]) => ({ week, ...agents }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [scores]);

  const latestByAgent = useMemo(() => {
    if (!outputs?.length) return {};
    const map: Record<string, (typeof outputs)[0]> = {};
    for (const o of outputs) {
      if (!map[o.agent_name] || o.run_date > map[o.agent_name].run_date) {
        map[o.agent_name] = o;
      }
    }
    return map;
  }, [outputs]);

  const underperforming = useMemo(() => {
    if (!scores?.length) return new Set<string>();
    const byAgent: Record<string, number[]> = {};
    for (const s of [...scores].sort((a, b) => a.run_date.localeCompare(b.run_date))) {
      if (!byAgent[s.agent_name]) byAgent[s.agent_name] = [];
      byAgent[s.agent_name].push(s.score);
    }
    const flagged = new Set<string>();
    for (const [agent, vals] of Object.entries(byAgent)) {
      if (vals.length >= 3) {
        const last3 = vals.slice(-3);
        if (last3.every((v) => v < 4)) flagged.add(agent);
      }
    }
    return flagged;
  }, [scores]);

  const agentNames = Object.keys(AGENT_DISPLAY);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-2.5">
        <p className="text-xs text-warning">
          <strong>DISCLAIMER:</strong> Agent analyses and recommendations are AI-generated
          and for informational purposes only. They do not constitute financial advice.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AGENT_NAMES.slice(0, 4).map((name, i) => {
          const key = RESEARCH_AGENTS[i];
          const latest = latestByAgent[key];
          const isWarn = underperforming.has(key);
          return (
            <Card key={i}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  Agent {i + 1}
                  {isWarn && (
                    <Badge variant="destructive" className="text-[10px]">
                      Low accuracy
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium">{name}</p>
                {latest ? (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                    {latest.summary.slice(0, 200)}...
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    No reports yet
                  </p>
                )}
                {latest?.judge_overall_score != null ? (
                  <p className="text-xs mt-1">
                    Score:{" "}
                    <span
                      className={
                        latest.judge_overall_score >= 7
                          ? "text-positive"
                          : latest.judge_overall_score >= 5
                            ? "text-warning"
                            : "text-negative"
                      }
                    >
                      {latest.judge_overall_score.toFixed(1)}/10
                    </span>
                  </p>
                ) : latest ? (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                    Score pending &mdash; next report run
                  </p>
                ) : null}
                {latest?.predictions && Array.isArray(latest.predictions) && latest.predictions.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border pt-1.5">
                    {latest.predictions.slice(0, 2).map((p, pi) => (
                      <div key={pi} className="flex items-start gap-1.5">
                        <Badge variant="outline" className="shrink-0 text-[9px] px-1 py-0">
                          {String(p.confidence ?? "?")}/10
                        </Badge>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                          {String(p.prediction ?? "")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sentiment / Accuracy</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "#8a8a9a" }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 11, fill: "#8a8a9a" }}
                  label={{
                    value: "Score",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#8a8a9a",
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d0d12",
                    border: "1px solid rgba(201,168,76,0.2)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={7} stroke="#22c55e" strokeDasharray="3 3" label="" />
                <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" label="" />
                {RESEARCH_AGENTS.map((agent, i) => (
                  <Line
                    key={agent}
                    type="monotone"
                    dataKey={agent}
                    name={AGENT_DISPLAY[agent]?.label ?? agent}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={[]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                  <XAxis tick={{ fontSize: 11, fill: "#8a8a9a" }} />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: "#8a8a9a" }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center mt-2 italic">
                {Object.keys(latestByAgent).length > 0
                  ? "Accuracy scores will appear after the second report \u2014 the Judge needs a prior run to evaluate predictions."
                  : "Score data will appear after agents run and the Judge evaluates them"}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
