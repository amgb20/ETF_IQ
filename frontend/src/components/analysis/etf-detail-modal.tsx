import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useETFDetail } from "@/hooks/use-etfs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SectorCountryBar } from "@/components/charts/sector-country-bars";
import { tickerLabel } from "@/lib/constants";

interface Props {
  isin: string | null;
  open: boolean;
  onClose: () => void;
}

function pct(v: number | null | undefined, decimals = 2) {
  return v != null ? `${v.toFixed(decimals)}%` : "\u2014";
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="font-medium">{value ?? "\u2014"}</div>
    </div>
  );
}

export function ETFDetailModal({ isin, open, onClose }: Props) {
  const { data: etf, isLoading } = useETFDetail(
    open ? (isin ?? undefined) : undefined
  );

  const sectors =
    etf?.allocations.filter((a) => a.allocation_type === "sector") ?? [];
  const countries =
    etf?.allocations.filter((a) => a.allocation_type === "country") ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>
            {etf
              ? `${tickerLabel(etf.ticker_yf, etf.isin)} \u2014 ${etf.name}`
              : (isin ?? "ETF Detail")}
          </DialogTitle>
          <DialogDescription>{etf?.isin ?? "Loading..."}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        ) : !etf ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Could not load ETF details.
          </p>
        ) : (
          <div className="space-y-6 py-2">
            {/* Fund Information */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Fund Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field
                  label="TER"
                  value={
                    etf.ter != null ? `${(etf.ter * 100).toFixed(2)}%` : null
                  }
                />
                <Field
                  label="AUM"
                  value={
                    etf.aum_eur
                      ? `\u20AC${(etf.aum_eur / 1e6).toFixed(0)}M`
                      : null
                  }
                />
                <Field label="Inception" value={etf.inception_date} />
                <Field label="Domicile" value={etf.domicile} />
                <Field label="Replication" value={etf.replication} />
                <Field label="Distribution" value={etf.distribution} />
                <Field label="Currency" value={etf.fund_currency} />
                <Field label="Provider" value={etf.fund_provider} />
                <Field label="Holdings" value={etf.holdings_count} />
              </div>
            </div>

            {/* Risk Overview */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Risk Overview</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1 font-medium">Metric</th>
                      <th className="text-right py-1 font-medium">1Y</th>
                      <th className="text-right py-1 font-medium">3Y</th>
                      <th className="text-right py-1 font-medium">5Y</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    <tr>
                      <td className="py-1.5 text-muted-foreground">
                        Volatility
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.vol_1y)}
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.vol_3y)}
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.vol_5y)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-muted-foreground">
                        Return/Risk
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.ret_risk_1y)}
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.ret_risk_3y)}
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.ret_risk_5y)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-muted-foreground">
                        Max Drawdown
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.max_dd_1y)}
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.max_dd_3y)}
                      </td>
                      <td className="text-right tabular-nums">
                        {pct(etf.max_dd_5y)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Holdings */}
            {etf.holdings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Top Holdings</h3>
                <div className="space-y-1">
                  {etf.holdings.slice(0, 10).map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs py-1"
                    >
                      <span className="truncate flex-1">
                        {h.holding_name ?? h.holding_isin ?? "Unknown"}
                      </span>
                      <Badge variant="secondary" className="text-[10px] ml-2">
                        {h.weight != null
                          ? `${h.weight.toFixed(2)}%`
                          : "\u2014"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allocations */}
            {(sectors.length > 0 || countries.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sectors.length > 0 && (
                  <div>
                    <SectorCountryBar
                      data={sectors}
                      color="#6366f1"
                      title="Sectors"
                    />
                  </div>
                )}
                {countries.length > 0 && (
                  <div>
                    <SectorCountryBar
                      data={countries}
                      color="#22c55e"
                      title="Countries"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {etf.description && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Description</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {etf.description}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
