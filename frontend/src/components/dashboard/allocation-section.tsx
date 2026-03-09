import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AllocationBar } from "@/components/charts/allocation-bar";
import { tickerLabel } from "@/lib/constants";
import type { PositionBrief } from "@/hooks/use-portfolios";

interface Props {
  positions: PositionBrief[];
  totalValue: number | null | undefined;
}

export function AllocationSection({ positions, totalValue }: Props) {
  if (!totalValue || positions.length === 0) return null;

  const items = positions.map((p) => ({
    ticker: tickerLabel(p.ticker_yf, p.etf_isin),
    actual: ((p.current_value ?? 0) / totalValue) * 100,
    target: p.target_allocation,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <AllocationBar items={items} />
      </CardContent>
    </Card>
  );
}
