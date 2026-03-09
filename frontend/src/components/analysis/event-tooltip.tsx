import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { ChartEvent } from "@/hooks/use-events";

interface Props {
  event: ChartEvent;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-500/20 text-green-400 border-green-500/30",
  negative: "bg-red-500/20 text-red-400 border-red-500/30",
  neutral: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export function EventTooltip({ event }: Props) {
  const sentimentClass =
    SENTIMENT_COLORS[event.sentiment ?? "neutral"] ?? SENTIMENT_COLORS.neutral;

  return (
    <div className="max-w-xs space-y-2 rounded-lg border border-border bg-popover p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{event.headline}</p>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${sentimentClass}`}>
          {event.sentiment}
        </Badge>
      </div>

      {event.description && (
        <p className="text-xs text-muted-foreground line-clamp-3">
          {event.description}
        </p>
      )}

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {event.source_agent && <span>Agent: {event.source_agent}</span>}
        {event.importance && <span>Importance: {event.importance}/5</span>}
      </div>

      {event.source_url && (
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Source
        </a>
      )}
    </div>
  );
}
