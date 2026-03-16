import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { ChartEvent } from "@/hooks/use-events";

interface OGData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  favicon: string | null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-500/20 text-green-400 border-green-500/30",
  negative: "bg-red-500/20 text-red-400 border-red-500/30",
  neutral: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Link preview with OG image + favicon ──────────────────────────────────
function LinkPreview({ url }: { url: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const domain = getDomain(url);

  const { data: og } = useQuery<OGData>({
    queryKey: ["og-meta", url],
    queryFn: () => apiFetch(`/meta/og?url=${encodeURIComponent(url)}`),
    staleTime: 60 * 60_000, // 1 hour
    retry: false,
  });

  const ogImage = og?.image ?? null;
  const faviconSrc = og?.favicon ?? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/link block rounded-md border border-border/60 overflow-hidden hover:border-border transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {ogImage && !imgFailed && (
        <img
          src={ogImage}
          alt=""
          className="w-full h-[90px] object-cover object-top bg-muted/50"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <img
          src={faviconSrc}
          alt=""
          className="h-3.5 w-3.5 rounded-sm shrink-0"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="text-[11px] text-muted-foreground truncate">
          {og?.site_name || domain}
        </span>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover/link:opacity-100 transition-opacity ml-auto" />
      </div>
    </a>
  );
}

// ── Single event item ─────────────────────────────────────────────────────
function EventItem({ event }: { event: ChartEvent }) {
  const sentiment = event.sentiment ?? "neutral";
  const sentimentClass = SENTIMENT_COLORS[sentiment] ?? SENTIMENT_COLORS.neutral;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${sentimentClass}`}>
          {sentiment}
        </Badge>
        {event.tickers?.length > 0 && (
          <div className="flex gap-1 ml-auto">
            {event.tickers.slice(0, 3).map((t) => (
              <span key={t} className="text-[9px] bg-muted px-1 py-0.5 rounded font-mono text-muted-foreground">
                {t.replace(".L", "")}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs font-medium leading-snug">{event.headline}</p>

      {event.description && (
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
          {event.description}
        </p>
      )}

      {event.source_url && <LinkPreview url={event.source_url} />}
    </div>
  );
}

// ── Static pinned card (click to open, X to close) ────────────────────────
interface EventPinnedCardProps {
  events: ChartEvent[];
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
  onClose: () => void;
}

export function EventPinnedCard({
  events,
  x,
  y,
  containerWidth,
  containerHeight,
  onClose,
}: EventPinnedCardProps) {
  const CARD_W = 280;
  const first = events[0];

  const spaceRight = containerWidth - x;
  const left = Math.max(4, spaceRight > CARD_W + 24 ? x + 16 : x - CARD_W - 16);
  const top = y > containerHeight * 0.55 ? Math.max(4, y - 220) : y + 16;

  return (
    <div className="absolute z-50" style={{ left, top }}>
      <div
        className="rounded-lg border border-border bg-popover/95 shadow-xl backdrop-blur-sm overflow-hidden"
        style={{ width: CARD_W, maxHeight: containerHeight - 8 }}
      >
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 bg-muted/30">
          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground font-medium">
            {formatDate(first.event_date)}
          </span>
          {events.length > 1 && (
            <span className="text-[10px] text-muted-foreground ml-auto mr-1">
              {events.length} events
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: containerHeight - 52 }}>
          <div className="divide-y divide-border/40">
            {events.map((ev) => (
              <div key={ev.id} className="px-3 py-2.5">
                <EventItem event={ev} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
