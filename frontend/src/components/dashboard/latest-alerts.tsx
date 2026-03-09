import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAlerts } from "@/hooks/use-alerts";

interface Props {
  portfolioId?: string;
}

const TYPE_COLORS: Record<string, "destructive" | "warning" | "secondary"> = {
  price_above: "warning",
  price_below: "destructive",
  pct_change: "destructive",
  volatility: "warning",
};

export function LatestAlerts({ portfolioId }: Props) {
  const { data: alerts } = useAlerts(portfolioId);

  const recentEvents = (alerts ?? [])
    .flatMap((a) =>
      a.events.map((ev) => ({
        ...ev,
        alertType: a.type,
        etfId: a.etf_id,
      })),
    )
    .sort((a, b) => (b.triggered_at ?? "").localeCompare(a.triggered_at ?? ""))
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" /> Latest Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentEvents.length > 0 ? (
          <div className="space-y-2">
            {recentEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-2 rounded-md border border-border p-2"
              >
                <Badge variant={TYPE_COLORS[ev.alertType] ?? "secondary"} className="text-[10px] shrink-0">
                  {ev.alertType.replace("_", " ")}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{ev.message || "Alert triggered"}</p>
                  {ev.triggered_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(ev.triggered_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No alerts triggered yet.{" "}
            <Link to="/analysis?tab=alerts" className="underline hover:text-foreground">
              Set up alerts
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
