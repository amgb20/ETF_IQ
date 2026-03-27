import type { ChatSource } from "@/hooks/use-chat";

function getUrl(source: ChatSource): string {
  return source.url || source.uri || "";
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
  } catch {
    return "";
  }
}

function dedup(sources: ChatSource[]): ChatSource[] {
  return sources.filter(
    (s, i, arr) => arr.findIndex((x) => getUrl(x) === getUrl(s)) === i,
  );
}

/* ═══════════════════════════════════════════════
   Stacked circular favicon pills (inline)
   — shows overlapping favicon circles + "N sources"
   — clicking navigates to Links tab
   ═══════════════════════════════════════════════ */

interface SourcePillsProps {
  sources: ChatSource[];
  onClick?: () => void;
}

export function SourcePills({ sources, onClick }: SourcePillsProps) {
  const unique = dedup(sources);
  if (unique.length === 0) return null;

  const MAX_ICONS = 4;
  const visible = unique.slice(0, MAX_ICONS);

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 mt-3 rounded-full border border-border bg-card px-3 py-1.5 hover:bg-secondary/60 sidebar-transition cursor-pointer"
      title="View all sources"
    >
      {/* Stacked favicon circles */}
      <div className="flex items-center -space-x-1.5">
        {visible.map((source) => {
          const href = getUrl(source);
          return (
            <img
              key={href}
              src={faviconUrl(href)}
              alt={getDomain(href)}
              width={20}
              height={20}
              className="h-5 w-5 rounded-full border-2 border-card bg-card shrink-0"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='10' fill='%23ddd'/%3E%3C/svg%3E";
              }}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {unique.length} source{unique.length !== 1 ? "s" : ""}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════
   Expanded link cards (for Links tab)
   ═══════════════════════════════════════════════ */

interface ExpandedSourcesProps {
  sources: ChatSource[];
}

export function ExpandedSources({ sources }: ExpandedSourcesProps) {
  const unique = dedup(sources);

  if (unique.length === 0) return null;

  return (
    <div className="space-y-2">
      {unique.map((source) => {
        const href = getUrl(source);
        if (!href) return null;
        return (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary/40 sidebar-transition no-underline group"
          >
            <img
              src={faviconUrl(href)}
              alt=""
              width={20}
              height={20}
              className="shrink-0 rounded"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary sidebar-transition">
                {source.title || getDomain(href)}
              </p>
              <p className="text-xs text-muted-foreground truncate">{getDomain(href)}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

/** Utility: collect all unique sources from a message array */
export function collectSources(messages: { sources?: ChatSource[] }[]): ChatSource[] {
  const seen = new Set<string>();
  const result: ChatSource[] = [];
  for (const msg of messages) {
    for (const s of msg.sources ?? []) {
      const url = getUrl(s);
      if (url && !seen.has(url)) {
        seen.add(url);
        result.push(s);
      }
    }
  }
  return result;
}
