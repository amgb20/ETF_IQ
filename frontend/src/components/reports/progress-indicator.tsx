import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import { useReportStatus, downloadReportUrl } from "@/hooks/use-reports";

interface Props {
  reportId: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Queued...",
  running: "Agents researching...",
  complete: "Report ready",
  failed: "Generation failed",
};

export function ProgressIndicator({ reportId }: Props) {
  const { data: status } = useReportStatus(reportId);
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    if (!status || status.status === "complete" || status.status === "failed") return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [status, startTime]);

  if (!status) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const isActive = status.status === "pending" || status.status === "running";
  const isComplete = status.status === "complete";
  const isFailed = status.status === "failed";

  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-4">
        {isActive && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {isComplete && <CheckCircle2 className="h-5 w-5 text-positive" />}
        {isFailed && <XCircle className="h-5 w-5 text-destructive" />}

        <div className="flex-1">
          <p className="text-sm font-medium">
            {STATUS_LABELS[status.status] ?? status.status}
          </p>
          {isActive && (
            <p className="text-xs text-muted-foreground">Elapsed: {timeStr}</p>
          )}
          {isComplete && status.summary_sentence && (
            <p className="text-xs text-muted-foreground mt-1">{status.summary_sentence}</p>
          )}
        </div>

        {isActive && (
          <Badge variant="secondary" className="text-xs">{status.current_step}</Badge>
        )}

        {isComplete && (
          <Button size="sm" variant="outline" onClick={() => window.open(downloadReportUrl(reportId), "_blank")}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            View PDF
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
