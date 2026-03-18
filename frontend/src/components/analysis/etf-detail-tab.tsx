import { useState } from "react";
import { useETFDetail } from "@/hooks/use-etfs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectorCountryBar } from "@/components/charts/sector-country-bars";
import { tickerLabel } from "@/lib/constants";
import type { ETFListItem } from "@/hooks/use-etfs";
import type { OverlapData } from "@/hooks/use-snapshot";

interface Props {
  etfs: ETFListItem[];
  overlap?: OverlapData;
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

function pct(v: number | null | undefined, decimals = 2) {
  return v != null ? `${v.toFixed ? v.toFixed(decimals) : v}%` : "—";
}

function ETFDetailContent({ isin, overlap }: { isin: string; overlap?: OverlapData }) {
  const { data: etf, isLoading, isError } = useETFDetail(isin);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-60" /><Skeleton className="h-40" /></div>;
  }

  if (isError || !etf) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Could not load ETF details for {isin}.</p>;
  }

  const sectors = etf.allocations.filter((a) => a.allocation_type === "sector");
  const countries = etf.allocations.filter((a) => a.allocation_type === "country");

  const overlapPartners: string[] = [];
  if (overlap?.overlap) {
    for (const [a, pairs] of Object.entries(overlap.overlap)) {
      if (a === isin) {
        overlapPartners.push(...Object.keys(pairs));
      }
      for (const [b, holdings] of Object.entries(pairs)) {
        if (b === isin && holdings.length > 0) {
          overlapPartners.push(a);
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{etf.name}</CardTitle>
          <CardDescription>
            {tickerLabel(etf.ticker_yf, etf.isin)} &middot; {etf.isin}
            {etf.fund_provider && <span className="ml-2 text-muted-foreground">by {etf.fund_provider}</span>}
          </CardDescription>
        </CardHeader>
        {etf.description && (
          <CardContent className="pt-0 pb-3">
            <p className="text-xs text-muted-foreground leading-relaxed">{etf.description}</p>
          </CardContent>
        )}
        {overlapPartners.length > 0 && (
          <CardContent className="pt-0 pb-3">
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">Overlaps with:</span>
              {overlapPartners.map((p) => (
                <Badge key={p} variant="warning" className="text-[10px]">{p}</Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Fund Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
            <Field label="Fund Size" value={etf.aum_eur != null ? `€${(etf.aum_eur / 1e6).toFixed(0)}M` : null} />
            <Field label="Total Expense Ratio" value={etf.ter != null ? `${(etf.ter * 100).toFixed(2)}%` : null} />
            <Field label="Index" value={etf.index_name} />
            <Field label="Index Description" value={etf.index_description} />
            <Field label="Investment Focus" value={etf.investment_focus} />
            <Field label="Replication" value={etf.replication} />
            <Field label="Legal Structure" value={etf.legal_structure} />
            <Field label="Strategy Risk" value={etf.strategy_risk} />
            <Field label="Sustainability" value={etf.sustainability} />
            <Field label="Fund Currency" value={etf.fund_currency ?? etf.currency} />
            <Field label="Currency Risk" value={etf.currency_risk} />
            <Field label="Inception Date" value={etf.inception_date} />
            <Field label="Distribution Policy" value={etf.distribution} />
            <Field label="Distribution Frequency" value={etf.distribution_frequency} />
            <Field label="Fund Domicile" value={etf.domicile} />
            <Field label="Fund Provider" value={etf.fund_provider} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Risk Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Metric</TableHead>
                  <TableHead className="text-right">1 Year</TableHead>
                  <TableHead className="text-right">3 Years</TableHead>
                  <TableHead className="text-right">5 Years</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Volatility</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(etf.vol_1y)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(etf.vol_3y)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(etf.vol_5y)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Return per Risk</TableCell>
                  <TableCell className="text-right tabular-nums">{etf.ret_risk_1y?.toFixed(2) ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{etf.ret_risk_3y?.toFixed(2) ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{etf.ret_risk_5y?.toFixed(2) ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Maximum Drawdown</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(etf.max_dd_1y)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(etf.max_dd_3y)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(etf.max_dd_5y)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {etf.max_dd_inception != null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Maximum drawdown since inception: <span className="font-medium text-foreground">{pct(etf.max_dd_inception)}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Holdings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Holdings in ETF</span>
              <div className="text-lg font-semibold">{etf.holdings_count ?? "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Holdings in Index</span>
              <div className="text-lg font-semibold">{etf.holdings_in_index ?? "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Weight of Top 10</span>
              <div className="text-lg font-semibold">
                {etf.top10_weight != null ? `${etf.top10_weight.toFixed(2)}%` : "—"}
              </div>
            </div>
          </div>

          {etf.holdings.length > 0 && (
            <>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top 10 Holdings</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {etf.holdings.slice(0, 10).map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{h.holding_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{h.holding_isin ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.weight != null ? `${(h.weight * 100).toFixed(2)}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {(sectors.length > 0 || countries.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sectors.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <SectorCountryBar data={sectors} title="Sector Allocation" color="#6366f1" />
              </CardContent>
            </Card>
          )}
          {countries.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <SectorCountryBar data={countries} title="Country Allocation" color="#22c55e" />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export function ETFDetailTab({ etfs, overlap }: Props) {
  const [selectedIsin, setSelectedIsin] = useState<string | undefined>();

  const resolvedIsin = selectedIsin && etfs.some((e) => e.isin === selectedIsin)
    ? selectedIsin
    : etfs.length > 0 ? etfs[0].isin : undefined;

  if (resolvedIsin !== selectedIsin) {
    setSelectedIsin(resolvedIsin);
  }

  if (etfs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No ETFs in your portfolio yet. Add some to view their details.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {etfs.map((etf) => {
          const label = tickerLabel(etf.ticker_yf, etf.isin);
          const active = etf.isin === selectedIsin;
          return (
            <Button
              key={etf.isin}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedIsin(etf.isin)}
            >
              {label}
            </Button>
          );
        })}
      </div>

      {selectedIsin && <ETFDetailContent isin={selectedIsin} overlap={overlap} />}
    </div>
  );
}
