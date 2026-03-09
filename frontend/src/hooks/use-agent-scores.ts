import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface AgentScoreEntry {
  agent_name: string;
  run_date: string;
  score: number;
}

export interface AgentOutput {
  id: string;
  agent_name: string;
  run_date: string;
  run_type: string;
  summary: string;
  predictions: Record<string, unknown>[] | null;
  reflection: string | null;
  judge_overall_score: number | null;
  judge_evaluation: Record<string, unknown> | null;
  research_mode: string | null;
  model_used: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  sources_cited: Record<string, unknown>[] | null;
  created_at: string | null;
}

export function useAgentScores(portfolioId: string | undefined, weeks = 12) {
  const params = new URLSearchParams();
  if (portfolioId) params.set("portfolio_id", portfolioId);
  params.set("weeks", String(weeks));

  return useQuery<AgentScoreEntry[]>({
    queryKey: ["agent-scores", portfolioId, weeks],
    queryFn: () => apiFetch(`/agent-outputs/scores?${params.toString()}`),
    enabled: !!portfolioId,
  });
}

export function useAgentOutputs(
  portfolioId: string | undefined,
  agent?: string,
  weeks = 12,
) {
  const params = new URLSearchParams();
  if (portfolioId) params.set("portfolio_id", portfolioId);
  if (agent) params.set("agent", agent);
  params.set("weeks", String(weeks));

  return useQuery<AgentOutput[]>({
    queryKey: ["agent-outputs", portfolioId, agent, weeks],
    queryFn: () => apiFetch(`/agent-outputs?${params.toString()}`),
    enabled: !!portfolioId,
  });
}
