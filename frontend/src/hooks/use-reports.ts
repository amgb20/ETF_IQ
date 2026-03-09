import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_BASE } from "@/lib/api-client";

export interface Report {
  id: string;
  portfolio_id: string;
  type: string;
  status: string;
  generated_at: string | null;
  summary_sentence: string | null;
  file_path: string | null;
  research_mode: string | null;
}

export interface ReportStatus {
  id: string;
  status: string;
  summary_sentence: string | null;
  current_step: string | null;
}

export function useReports(portfolioId: string | undefined) {
  return useQuery<Report[]>({
    queryKey: ["reports", portfolioId],
    queryFn: () => apiFetch(`/reports?portfolio_id=${portfolioId}`),
    enabled: !!portfolioId,
  });
}

export function useReportStatus(reportId: string | undefined) {
  return useQuery<ReportStatus>({
    queryKey: ["report-status", reportId],
    queryFn: () => apiFetch(`/reports/${reportId}/status`),
    enabled: !!reportId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending" || status === "running") return 3000;
      return false;
    },
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      portfolio_id: string;
      type: string;
      sections?: string[];
    }) => apiFetch<Report>("/reports", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["reports", data.portfolio_id] });
    },
  });
}

export function downloadReportUrl(reportId: string): string {
  return `${API_BASE}/reports/${reportId}/download`;
}
