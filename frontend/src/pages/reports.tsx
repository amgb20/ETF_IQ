import { useState } from "react";
import { usePortfolios } from "@/hooks/use-portfolios";
import { GenerateReportForm } from "@/components/reports/generate-report-form";
import { ProgressIndicator } from "@/components/reports/progress-indicator";
import { ReportArchiveTable } from "@/components/reports/report-archive-table";
import { AgentMemoryExplorer } from "@/components/reports/agent-memory-explorer";
import { PageHeader } from "@/components/layout/page-header";

export default function ReportsPage() {
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Reports" />
      <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
      <GenerateReportForm
        portfolioId={portfolioId}
        onGenerated={(id) => setActiveReportId(id)}
      />
      {activeReportId && <ProgressIndicator reportId={activeReportId} />}
      <ReportArchiveTable portfolioId={portfolioId} />
      <AgentMemoryExplorer portfolioId={portfolioId} />
    </div>
    </>
  );
}
