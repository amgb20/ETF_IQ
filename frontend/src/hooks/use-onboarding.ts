import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  ClassifyThemesResponse,
  CorrelationsResponse,
  CorrelatedPairInput,
  AdvisorResponse,
  OnboardingStatusResponse,
} from "@/types/onboarding";

export function useOnboardingStatus() {
  return useQuery<OnboardingStatusResponse>({
    queryKey: ["onboarding-status"],
    queryFn: () => apiFetch("/onboarding/status"),
    staleTime: 60_000,
  });
}

export function useClassifyThemes() {
  return useMutation<ClassifyThemesResponse, Error, { etf_ids: string[] }>({
    mutationFn: (body) =>
      apiFetch("/onboarding/classify-themes", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useComputeCorrelations() {
  return useMutation<
    CorrelationsResponse,
    Error,
    { etf_ids: string[]; lookback_days?: number }
  >({
    mutationFn: (body) =>
      apiFetch("/onboarding/correlations", {
        method: "POST",
        body: JSON.stringify({ lookback_days: 365, ...body }),
      }),
  });
}

export function useCorrelationAdvisor() {
  return useMutation<
    AdvisorResponse,
    Error,
    { correlated_pairs: CorrelatedPairInput[]; all_etf_ids: string[] }
  >({
    mutationFn: (body) =>
      apiFetch("/onboarding/advisor", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

interface CompleteOnboardingBody {
  portfolio_name: string;
  description?: string;
  themes: {
    name: string;
    color: string;
    research_agent?: string | null;
    positions: {
      etf_id: string;
      shares: number;
      entry_price: number;
      entry_date: string;
      invested_amount: number;
      target_allocation: number | null;
    }[];
  }[];
}

export function useCompleteOnboarding() {
  return useMutation<{ portfolio_id: string; status: string }, Error, CompleteOnboardingBody>({
    mutationFn: (body) =>
      apiFetch("/onboarding/complete", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
