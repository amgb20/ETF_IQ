import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useETFs } from "@/hooks/use-etfs";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useOverlap } from "@/hooks/use-snapshot";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartWorkspace } from "@/components/analysis/chart-workspace";
import { ETFDetailTab } from "@/components/analysis/etf-detail-tab";
import { AgentReportsTab } from "@/components/analysis/agent-reports-tab";
import { AlertsTab } from "@/components/analysis/alerts-tab";

export default function AnalysisPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "etf-detail";
  const [selectedIsins, setSelectedIsins] = useState<string[]>([]);

  const { data: etfs, isLoading: etfsLoading } = useETFs();
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: overlap } = useOverlap(portfolioId);

  const handleToggleETF = (isin: string) => {
    setSelectedIsins((prev) =>
      prev.includes(isin) ? prev.filter((i) => i !== isin) : [...prev, isin]
    );
  };

  const lastSelected = selectedIsins[selectedIsins.length - 1];

  if (etfsLoading) {
    return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-[400px]" /></div>;
  }

  return (
    <div className="space-y-6">
      <ChartWorkspace
        etfs={etfs ?? []}
        selectedIsins={selectedIsins}
        onToggleETF={handleToggleETF}
        portfolioId={portfolioId}
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="etf-detail">ETF Detail</TabsTrigger>
          <TabsTrigger value="agent-reports">Agent Reports</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="etf-detail">
          <ETFDetailTab isin={lastSelected} overlap={overlap} />
        </TabsContent>

        <TabsContent value="agent-reports">
          <AgentReportsTab portfolioId={portfolioId} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsTab etfs={etfs ?? []} portfolioId={portfolioId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
