import { Link, useParams } from "react-router-dom";
import { FileText, BarChart3, Bell } from "lucide-react";

const ACTIONS = [
  { path: "reports", Icon: FileText, label: "Generate Report", sub: "New AI analysis" },
  { path: "analysis", Icon: BarChart3, label: "Full Analysis", sub: "Charts & metrics" },
  { path: "analysis/alerts", Icon: Bell, label: "Set Alerts", sub: "Price monitoring" },
];

export function QuickActions() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <div className="grid grid-cols-3 gap-3">
      {ACTIONS.map(({ path, Icon, label, sub }) => (
        <Link
          key={path}
          to={`/${userId}/${path}`}
          className="group flex flex-col gap-2 rounded-lg border border-border bg-secondary/50 p-4
                     hover:border-primary/40 hover:bg-primary/5 transition-[border-color,background-color] duration-200"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
