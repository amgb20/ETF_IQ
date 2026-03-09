import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART_COLORS, tickerLabel } from "@/lib/constants";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { PositionBrief } from "@/hooks/use-portfolios";

interface Props {
  positions: PositionBrief[];
}

export function ThemeCards({ positions }: Props) {
  const themes = useMemo(() => {
    const groups: Record<string, PositionBrief[]> = {};
    for (const p of positions) {
      const label = p.theme_name ?? "Other";
      (groups[label] ??= []).push(p);
    }
    return Object.entries(groups).map(([name, items], i) => ({
      name,
      color: CHART_COLORS[i % CHART_COLORS.length],
      positions: items,
    }));
  }, [positions]);

  if (themes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No positions yet. Add ETFs to see your themes.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {themes.map((theme) => {
        const invested = theme.positions.reduce((s, p) => s + p.invested_amount, 0);
        const value = theme.positions.reduce((s, p) => s + (p.current_value ?? p.invested_amount), 0);
        const pnlPct = invested > 0 ? ((value - invested) / invested) * 100 : null;

        return (
          <Card key={theme.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.color }} />
                <CardTitle className="text-base">{theme.name}</CardTitle>
                {pnlPct != null && (
                  <Badge variant={pnlPct >= 0 ? "positive" : "negative"} className="ml-auto">
                    {formatPct(pnlPct)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium">{formatCurrency(value)}</p>
              <p className="text-xs text-muted-foreground">
                {theme.positions.map((p) => tickerLabel(p.ticker_yf, p.etf_isin)).join(", ")}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
