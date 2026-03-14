import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { tickerLabel } from "@/lib/constants";
import type { ETFListItem, QuoteData } from "@/hooks/use-etfs";

interface Props {
  etfs: ETFListItem[];
}

function formatPrice(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function W52Bar({ low, high, current }: { low: number | null; high: number | null; current: number | null }) {
  if (low == null || high == null || current == null) return null;
  const range = high - low;
  if (range <= 0) return null;
  const pct = Math.min(Math.max(((current - low) / range) * 100, 0), 100);

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>{formatPrice(low)}</span>
        <span>52-Week Range</span>
        <span>{formatPrice(high)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-secondary">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-negative via-warning to-positive"
          style={{ width: "100%" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3.5 w-1 rounded-full bg-primary shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function QuoteTab({ etfs }: Props) {
  const quoteQueries = useQueries({
    queries: etfs.map((e) => ({
      queryKey: ["etf-quote", e.isin],
      queryFn: () => apiFetch<QuoteData>(`/etfs/${e.isin}/quote`),
      enabled: !!e.isin,
    })),
  });

  const loading = quoteQueries.some((q) => q.isLoading);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {etfs.map((e) => <Skeleton key={e.isin} className="h-48" />)}
      </div>
    );
  }

  if (etfs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Select ETFs to view quotes.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {quoteQueries.map((q, i) => {
        const etf = etfs[i];
        const quote = q.data;
        const ticker = tickerLabel(etf.ticker_yf, etf.isin);
        const positive = (quote?.day_change ?? 0) >= 0;

        return (
          <Card key={etf.isin}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{ticker}</span>
                <span className="text-xs text-muted-foreground font-normal">{etf.isin}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-semibold tabular-nums">
                  {formatPrice(quote?.last_close ?? null)}
                </span>
                {quote?.day_change != null && (
                  <span className={`text-sm font-medium ${positive ? "text-positive" : "text-negative"}`}>
                    {positive ? "+" : ""}{quote.day_change.toFixed(2)}
                    {" "}({positive ? "+" : ""}{quote.day_change_pct?.toFixed(2) ?? "—"}%)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Previous Close</span>
                  <div className="font-medium tabular-nums">{formatPrice(quote?.previous_close ?? null)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <div className="font-medium">{quote?.last_date ?? "—"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">52W Low</span>
                  <div className="font-medium tabular-nums">{formatPrice(quote?.week_52_low ?? null)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">52W High</span>
                  <div className="font-medium tabular-nums">{formatPrice(quote?.week_52_high ?? null)}</div>
                </div>
              </div>

              <W52Bar
                low={quote?.week_52_low ?? null}
                high={quote?.week_52_high ?? null}
                current={quote?.last_close ?? null}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
