import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useGenerateReport } from "@/hooks/use-reports";

const REPORT_TYPES = ["Weekly Health", "Monthly Deep Research"] as const;
const SECTIONS = ["Exec Summary", "AI Stack", "Gold", "Defence", "Macro", "Risk", "Recommendations"];

interface Props {
  portfolioId: string | undefined;
  onGenerated: (reportId: string) => void;
}

export function GenerateReportForm({ portfolioId, onGenerated }: Props) {
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0]);
  const [dateMode, setDateMode] = useState<string>("auto");
  const [checkedSections, setCheckedSections] = useState<string[]>([...SECTIONS]);
  const generateReport = useGenerateReport();

  const toggleSection = (s: string) =>
    setCheckedSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const isDeep = reportType === "Monthly Deep Research";

  const handleGenerate = () => {
    if (!portfolioId) return;
    generateReport.mutate(
      {
        portfolio_id: portfolioId,
        type: isDeep ? "monthly" : "weekly",
        sections: checkedSections.length < SECTIONS.length ? checkedSections : undefined,
      },
      {
        onSuccess: (report) => onGenerated(report.id),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Generate Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Report Type</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Date Range</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"
              value={dateMode}
              onChange={(e) => setDateMode(e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        {dateMode === "custom" && (
          <div className="flex gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">From</label>
              <input type="date" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">To</label>
              <input type="date" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Sections</label>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={checkedSections.includes(s)}
                  onChange={() => toggleSection(s)}
                  className="rounded border-input"
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            Mode: {isDeep ? "Deep Research (10min thinking cap)" : "Standard"}
          </Badge>
        </div>

        <Button
          className="w-full sm:w-auto"
          onClick={handleGenerate}
          disabled={!portfolioId || generateReport.isPending}
        >
          {generateReport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Report
        </Button>
      </CardContent>
    </Card>
  );
}
