/** Derive a short display label from an ETF's ticker_yf or ISIN. */
export function tickerLabel(tickerYf: string | null | undefined, isin: string): string {
  if (tickerYf) return tickerYf.replace(/\.L$/, "");
  return isin.slice(0, 6);
}

export const CHART_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899",
];
