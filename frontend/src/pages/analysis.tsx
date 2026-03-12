import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { usePortfolios, usePortfolio } from "@/hooks/use-portfolios";
import { useOverlap } from "@/hooks/use-snapshot";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartWorkspace } from "@/components/analysis/chart-workspace";
import { ETFDetailTab } from "@/components/analysis/etf-detail-tab";
import { AgentReportsTab } from "@/components/analysis/agent-reports-tab";
import { AlertsTab } from "@/components/analysis/alerts-tab";
import { AddPositionModal } from "@/components/analysis/add-position-modal";
import type { ETFListItem } from "@/hooks/use-etfs";

const VALID_TABS = ["etf-detail", "agent-reports", "alerts"] as const;
type TabValue = (typeof VALID_TABS)[number];

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [selectedIsins, setSelectedIsins] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const segments = location.pathname.split("/");
  const lastSegment = segments[segments.length - 1];
  const activeTab: TabValue = (VALID_TABS as readonly string[]).includes(lastSegment)
    ? (lastSegment as TabValue)
    : "etf-detail";

  useEffect(() => {
    if (!(VALID_TABS as readonly string[]).includes(lastSegment)) {
      navigate(`/${userId}/analysis/etf-detail`, { replace: true });
    }
  }, [lastSegment, navigate, userId]);

  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio(portfolioId);
  const { data: overlap } = useOverlap(portfolioId);

  const positions = portfolio?.positions ?? [];

  const portfolioEtfs: ETFListItem[] = useMemo(
    () =>
      positions.map((p) => ({
        id: p.etf_id,
        isin: p.etf_isin,
        ticker_yf: p.ticker_yf,
        name: p.etf_name,
        currency: null,
        exchange: null,
      })),
    [positions],
  );

  useEffect(() => {
    if (portfolioEtfs.length > 0 && selectedIsins.length === 0) {
      setSelectedIsins(portfolioEtfs.map((e) => e.isin));
    }
  }, [portfolioEtfs.length]);

  const handleToggleETF = (isin: string) => {
    setSelectedIsins((prev) =>
      prev.includes(isin) ? prev.filter((i) => i !== isin) : [...prev, isin]
    );
  };

  const lastSelected = selectedIsins[selectedIsins.length - 1];

  const handleTabChange = (value: string) => {
    navigate(`/${userId}/analysis/${value}`, { replace: true });
  };

  if (portfolioLoading) {
    return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-[400px]" /></div>;
  }

  return (
    <div className="space-y-6">
      <ChartWorkspace
        etfs={portfolioEtfs}
        selectedIsins={selectedIsins}
        onToggleETF={handleToggleETF}
        portfolioId={portfolioId}
        onAddETF={() => setAddModalOpen(true)}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
          <AlertsTab etfs={portfolioEtfs} portfolioId={portfolioId} />
        </TabsContent>
      </Tabs>

      {portfolioId && (
        <AddPositionModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          portfolioId={portfolioId}
          existingIsins={portfolioEtfs.map((e) => e.isin)}
        />
      )}
    </div>
  );
}
