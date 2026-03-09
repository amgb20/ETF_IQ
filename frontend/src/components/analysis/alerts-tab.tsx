import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ETFListItem } from "@/hooks/use-etfs";
import { tickerLabel } from "@/lib/constants";
import {
  useAlerts,
  useCreateAlert,
  useUpdateAlert,
  useDeleteAlert,
} from "@/hooks/use-alerts";
import { Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface Props {
  etfs: ETFListItem[];
  portfolioId?: string;
}

const ALERT_TYPES = ["price_above", "price_below", "pct_change", "volatility"];

export function AlertsTab({ etfs, portfolioId }: Props) {
  const [selectedEtf, setSelectedEtf] = useState("");
  const [alertType, setAlertType] = useState(ALERT_TYPES[0]);
  const [threshold, setThreshold] = useState("");

  const { data: alerts, isLoading } = useAlerts(portfolioId);
  const createAlert = useCreateAlert();
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();

  const handleCreate = () => {
    if (!portfolioId || !selectedEtf || !threshold) return;
    const etf = etfs.find((e) => e.isin === selectedEtf);
    if (!etf) return;

    createAlert.mutate(
      {
        portfolio_id: portfolioId,
        etf_id: etf.id,
        type: alertType,
        threshold: parseFloat(threshold),
      },
      {
        onSuccess: () => {
          setThreshold("");
        },
      },
    );
  };

  const allEvents = (alerts ?? [])
    .flatMap((a) =>
      a.events.map((ev) => ({
        ...ev,
        alertType: a.type,
        threshold: a.threshold,
      })),
    )
    .sort((a, b) => (b.triggered_at ?? "").localeCompare(a.triggered_at ?? ""));

  const etfMap: Record<string, string> = {};
  for (const etf of etfs) {
    etfMap[etf.id] = tickerLabel(etf.ticker_yf, etf.isin);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground italic">Loading...</p>
          ) : alerts && alerts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ETF</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="text-xs">
                      {alert.etf_id ? etfMap[alert.etf_id] ?? alert.etf_id : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {alert.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{alert.threshold}</TableCell>
                    <TableCell className="text-xs">{alert.trigger_count}</TableCell>
                    <TableCell>
                      <button
                        className="inline-flex items-center gap-1 text-xs"
                        onClick={() =>
                          updateAlert.mutate({
                            id: alert.id,
                            is_active: !alert.is_active,
                          })
                        }
                      >
                        {alert.is_active ? (
                          <>
                            <ToggleRight className="h-4 w-4 text-green-400" />
                            <span className="text-green-400">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Inactive</span>
                          </>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteAlert.mutate(alert.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground italic">No alerts configured.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Create Alert</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">ETF</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={selectedEtf}
                onChange={(e) => setSelectedEtf(e.target.value)}
              >
                <option value="">Select...</option>
                {etfs.map((e) => (
                  <option key={e.isin} value={e.isin}>
                    {tickerLabel(e.ticker_yf, e.isin)} — {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Type</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={alertType}
                onChange={(e) => setAlertType(e.target.value)}
              >
                {ALERT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Threshold</label>
              <input
                type="number"
                step="any"
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-24"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>

            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!portfolioId || !selectedEtf || !threshold || createAlert.isPending}
            >
              {createAlert.isPending ? "Creating..." : "Create Alert"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {allEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Alert History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allEvents.slice(0, 20).map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs">
                      {ev.triggered_at ? new Date(ev.triggered_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {ev.alertType.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {ev.actual_value != null ? ev.actual_value.toFixed(4) : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">
                      {ev.message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
