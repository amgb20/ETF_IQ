import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortfolios, usePortfolio } from "@/hooks/use-portfolios";
import { useOverlap } from "@/hooks/use-snapshot";
import { apiFetch } from "@/lib/api-client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartWorkspace } from "@/components/analysis/chart-workspace";
import { ETFDetailTab } from "@/components/analysis/etf-detail-tab";
import { AgentReportsTab } from "@/components/analysis/agent-reports-tab";
import { AlertsTab } from "@/components/analysis/alerts-tab";
import { QuoteTab } from "@/components/analysis/quote-tab";
import { AddPositionModal } from "@/components/analysis/add-position-modal";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import type { ETFListItem } from "@/hooks/use-etfs";

const VALID_TABS = ["quote", "etf-detail", "agent-reports", "alerts"] as const;
type TabValue = (typeof VALID_TABS)[number];

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const qc = useQueryClient();
  const [selectedIsins, setSelectedIsins] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const segments = location.pathname.split("/");
  const lastSegment = segments[segments.length - 1];
  const activeTab: TabValue = (VALID_TABS as readonly string[]).includes(lastSegment)
    ? (lastSegment as TabValue)
    : "quote";

  useEffect(() => {
    if (!(VALID_TABS as readonly string[]).includes(lastSegment)) {
      navigate(`/${userId}/analysis/quote`, { replace: true });
    }
  }, [lastSegment, navigate, userId]);

  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio(portfolioId);
  const { data: overlap } = useOverlap(portfolioId);

  const positions = portfolio?.positions ?? [];

  console.log("[analysis] portfolioId=%s  positions=%d  portfolio=", portfolioId, positions.length, portfolio);

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

  console.log("[analysis] portfolioEtfs=", portfolioEtfs, " selectedIsins=", selectedIsins);

  useEffect(() => {
    if (portfolioEtfs.length > 0 && selectedIsins.length === 0) {
      setSelectedIsins(portfolioEtfs.map((e) => e.isin));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioEtfs.length]);

  // Auto-sync: check price freshness on mount, sync if stale
  const { data: priceStatus } = useQuery({
    queryKey: ["prices", "status"],
    queryFn: () => apiFetch<{ latest_date: string | null; needs_sync: boolean }>("/prices/status"),
    staleTime: 5 * 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiFetch<{ status: string; tickers_synced: string[]; total_price_rows: number }>("/prices/sync", { method: "POST" }),
    onSuccess: (data) => {
      console.log("[analysis] price sync complete:", data);
      qc.invalidateQueries({ queryKey: ["prices"] });
    },
    onError: (err) => {
      console.error("[analysis] price sync failed:", err);
    },
  });

  useEffect(() => {
    if (priceStatus?.needs_sync && !syncMutation.isPending && !syncMutation.isSuccess) {
      syncMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceStatus?.needs_sync]);

  const handleToggleETF = (isin: string) => {
    setSelectedIsins((prev) =>
      prev.includes(isin) ? prev.filter((i) => i !== isin) : [...prev, isin]
    );
  };

  const handleTabChange = (value: string) => {
    navigate(`/${userId}/analysis/${value}`, { replace: true });
  };

  if (portfolioLoading) {
    return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-[400px]" /></div>;
  }

  return (
    <>
      <PageHeader title="Analysis">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          {syncMutation.isPending ? (
            <><RefreshCw className="h-3 w-3 animate-spin" /> Syncing prices...</>
          ) : priceStatus?.latest_date ? (
            <>Prices as of {priceStatus.latest_date}</>
          ) : null}
        </span>
      </PageHeader>
      <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">

      <ChartWorkspace
        etfs={portfolioEtfs}
        selectedIsins={selectedIsins}
        onToggleETF={handleToggleETF}
        portfolioId={portfolioId}
        onAddETF={() => setAddModalOpen(true)}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="quote">Quote</TabsTrigger>
          <TabsTrigger value="etf-detail">ETF Detail</TabsTrigger>
          <TabsTrigger value="agent-reports">Agent Reports</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="quote">
          <QuoteTab etfs={selectedIsins.length > 0
            ? portfolioEtfs.filter((e) => selectedIsins.includes(e.isin))
            : portfolioEtfs}
          />
        </TabsContent>

        <TabsContent value="etf-detail">
          <ETFDetailTab etfs={portfolioEtfs} overlap={overlap} />
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
    </>
  );
}
