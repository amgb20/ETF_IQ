import { useMemo } from "react";
import { usePortfolios, usePortfolio } from "@/hooks/use-portfolios";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthSummary } from "@/components/dashboard/health-summary";
import { ThemeCards } from "@/components/dashboard/theme-cards";
import { AllocationSection } from "@/components/dashboard/allocation-section";
import { LatestAlerts } from "@/components/dashboard/latest-alerts";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PortfolioValueChart } from "@/components/charts/portfolio-value-chart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const { data: portfolios, isLoading: listLoading } = usePortfolios();
  const firstId = portfolios?.[0]?.id;
  const { data: portfolio, isLoading: detailLoading } = usePortfolio(firstId);

  const loading = listLoading || detailLoading;
  const positions = portfolio?.positions ?? [];

  const chartData = useMemo(() => {
    if (!portfolio?.total_value || positions.length === 0) return [];
    return [{ time: new Date().toISOString().split("T")[0], value: portfolio.total_value }];
  }, [portfolio?.total_value, positions.length]);

  return (
    <div className="space-y-6">
      <HealthSummary
        totalValue={portfolio?.total_value}
        pnlPct={portfolio?.total_pnl_pct}
        loading={loading}
        portfolioId={firstId}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && positions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No positions yet. Add positions to see the chart.
            </p>
          ) : (
            <>
              <PortfolioValueChart data={chartData} loading={loading} />
              {!loading && chartData.length <= 1 && positions.length > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Price history will appear after the first data sync.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ThemeCards positions={positions} />

      <AllocationSection positions={positions} totalValue={portfolio?.total_value} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LatestAlerts portfolioId={firstId} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActions />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
