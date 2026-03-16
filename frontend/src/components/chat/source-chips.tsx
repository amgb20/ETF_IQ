import type { ChatSource } from "@/hooks/use-chat";

interface Props {
  sources: ChatSource[];
}

/** Get the effective URL from a source (supports both `url` and legacy `uri` key). */
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

export function SourceChips({ sources }: Props) {
  if (!sources.length) return null;

  const unique = sources.filter(
    (s, i, arr) => arr.findIndex((x) => getUrl(x) === getUrl(s)) === i,
  );

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {unique.map((source) => {
        const href = getUrl(source);
        if (!href) return null;
        return (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title || href}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground no-underline"
          >
            <img
              src={faviconUrl(href)}
              alt=""
              width={14}
              height={14}
              className="shrink-0 rounded-sm"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="max-w-[140px] truncate">{getDomain(href)}</span>
          </a>
        );
      })}
    </div>
  );
}
