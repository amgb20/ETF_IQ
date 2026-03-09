import { useETFDetail } from "@/hooks/use-etfs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectorCountryBar } from "@/components/charts/sector-country-bars";
import { tickerLabel } from "@/lib/constants";
import type { OverlapData } from "@/hooks/use-snapshot";

interface Props {
  isin: string | undefined;
  overlap?: OverlapData;
}

export function ETFDetailTab({ isin, overlap }: Props) {
  const { data: etf, isLoading } = useETFDetail(isin);

  if (!isin) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Select an ETF to view details.</p>;
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  }

  if (!etf) {
    return <p className="text-sm text-muted-foreground py-8 text-center">ETF not found.</p>;
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
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
            <div><span className="text-muted-foreground">TER:</span> {etf.ter != null ? `${(etf.ter * 100).toFixed(2)}%` : "—"}</div>
            <div><span className="text-muted-foreground">AUM:</span> {etf.aum_eur != null ? `€${(etf.aum_eur / 1e6).toFixed(0)}M` : "—"}</div>
            <div><span className="text-muted-foreground">Inception:</span> {etf.inception_date ?? "—"}</div>
            <div><span className="text-muted-foreground">Domicile:</span> {etf.domicile ?? "—"}</div>
            <div><span className="text-muted-foreground">Replication:</span> {etf.replication ?? "—"}</div>
            <div><span className="text-muted-foreground">Distribution:</span> {etf.distribution ?? "—"}</div>
            <div><span className="text-muted-foreground">Vol (1Y):</span> {etf.vol_1y != null ? `${etf.vol_1y}%` : "—"}</div>
            <div><span className="text-muted-foreground">Max DD (1Y):</span> {etf.max_dd_1y != null ? `${etf.max_dd_1y}%` : "—"}</div>
          </div>

          {overlapPartners.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">Overlaps with:</span>
              {overlapPartners.map((p) => (
                <Badge key={p} variant="warning" className="text-[10px]">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {etf.holdings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Holdings</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <TableCell className="text-right">{h.weight != null ? `${(h.weight * 100).toFixed(2)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sectors.length > 0 && <Card><CardContent className="pt-4"><SectorCountryBar data={sectors} title="Sector Allocation" color="#6366f1" /></CardContent></Card>}
        {countries.length > 0 && <Card><CardContent className="pt-4"><SectorCountryBar data={countries} title="Country Allocation" color="#22c55e" /></CardContent></Card>}
      </div>
    </div>
  );
}
