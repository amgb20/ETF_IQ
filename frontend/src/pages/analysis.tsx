import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePortfolios, usePortfolio } from "@/hooks/use-portfolios";
import { useOverlap } from "@/hooks/use-snapshot";
import { apiFetch } from "@/lib/api-client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartWorkspace } from "@/components/analysis/chart-workspace";
import { ETFDetailTab } from "@/components/analysis/etf-detail-tab";
import { AgentReportsTab } from "@/components/analysis/agent-reports-tab";
import { AlertsTab } from "@/components/analysis/alerts-tab";
import { QuoteTab } from "@/components/analysis/quote-tab";
import { AddPositionModal } from "@/components/analysis/add-position-modal";
import { RefreshCw } from "lucide-react";
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
      console.log("[analysis] pre-selecting all ETFs:", portfolioEtfs.map((e) => e.isin));
      setSelectedIsins(portfolioEtfs.map((e) => e.isin));
    }
  }, [portfolioEtfs.length]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analysis</h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing..." : "Sync Prices"}
        </Button>
      </div>

      {syncMutation.isSuccess && (
        <p className="text-sm text-green-600">
          Synced {syncMutation.data.tickers_synced.join(", ")} — {syncMutation.data.total_price_rows} price rows available.
        </p>
      )}
      {syncMutation.isError && (
        <p className="text-sm text-destructive">
          Sync failed: {syncMutation.error?.message}
        </p>
      )}

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
  );
}
