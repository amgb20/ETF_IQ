import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Bell } from "lucide-react";

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" asChild>
        <Link to="/reports">
          <FileText className="mr-2 h-4 w-4" /> Generate Report
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/analysis">
          <BarChart3 className="mr-2 h-4 w-4" /> Full Analysis
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/analysis?tab=alerts">
          <Bell className="mr-2 h-4 w-4" /> Alerts
        </Link>
      </Button>
    </div>
  );
}
