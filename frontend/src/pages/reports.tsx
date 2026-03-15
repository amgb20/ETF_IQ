import { useState } from "react";
import { usePortfolios } from "@/hooks/use-portfolios";
import { GenerateReportForm } from "@/components/reports/generate-report-form";
import { ProgressIndicator } from "@/components/reports/progress-indicator";
import { ReportArchiveTable } from "@/components/reports/report-archive-table";
import { AgentMemoryExplorer } from "@/components/reports/agent-memory-explorer";

export default function ReportsPage() {
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-semibold">Reports</h1>
        <p className="text-xs text-muted-foreground pb-1 tracking-wider">AI-generated analysis</p>
      </div>
      <GenerateReportForm
        portfolioId={portfolioId}
        onGenerated={(id) => setActiveReportId(id)}
      />
      {activeReportId && <ProgressIndicator reportId={activeReportId} />}
      <ReportArchiveTable portfolioId={portfolioId} />
      <AgentMemoryExplorer portfolioId={portfolioId} />
    </div>
  );
}
