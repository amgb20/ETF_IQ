import type { ChatSource } from "@/hooks/use-chat";

interface Props {
  sources: ChatSource[];
}

function getDomain(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return uri;
  }
}

function faviconUrl(uri: string): string {
  try {
    const { hostname } = new URL(uri);
    return `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
  } catch {
    return "";
  }
}

export function SourceChips({ sources }: Props) {
  if (!sources.length) return null;

  const unique = sources.filter(
    (s, i, arr) => arr.findIndex((x) => x.uri === s.uri) === i,
  );

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {unique.map((source) => (
        <a
          key={source.uri}
          href={source.uri}
          target="_blank"
          rel="noopener noreferrer"
          title={source.title || source.uri}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground no-underline"
        >
          <img
            src={faviconUrl(source.uri)}
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
          <span className="max-w-[140px] truncate">{getDomain(source.uri)}</span>
        </a>
      ))}
    </div>
  );
}
