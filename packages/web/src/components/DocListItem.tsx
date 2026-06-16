import type { DocListItem as DocItem } from "@pipeit/shared";
import { useState } from "react";
import { Link } from "react-router-dom";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

export function DocListItem({
  doc,
  onToggle,
  onDelete,
}: {
  doc: DocItem;
  onToggle: (slug: string, next: boolean) => void;
  onDelete: (slug: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const pct = doc.read_pct ?? 0;
  const pctColor = pct >= 1 ? "text-ok" : pct > 0 ? "text-warn" : "text-muted";
  const barColor = pct >= 1 ? "bg-ok" : pct > 0 ? "bg-warn" : "bg-hair";

  // These buttons live inside the <Link>, so suppress navigation on click.
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      to={`/d/${doc.slug}`}
      className="group block px-3.5 py-3 rounded-xl bg-raise/60 border border-hair hover:border-accent/50 hover:bg-raise transition mb-2"
    >
      <div className="font-medium text-[15px] leading-snug text-ink mb-2 truncate">{doc.title}</div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted whitespace-nowrap">
          v{doc.version}
          <span className="text-hair">&middot;</span>
          {timeAgo(doc.updated_at)}
        </span>
        <div className="flex items-center gap-2.5">
          <span className={`tabular-nums ${pctColor}`}>{Math.round(pct * 100)}%</span>
          <div className="w-8 h-1 bg-hair rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct * 100}%` }} />
          </div>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onToggle(doc.slug, !doc.is_public);
            }}
            aria-label={`Make ${doc.is_public ? "private" : "public"}`}
            title={`Make ${doc.is_public ? "private" : "public"}`}
            className={`text-[11px] font-medium px-2 py-1 rounded-md transition ${
              doc.is_public ? "bg-ok/15 text-ok hover:bg-ok/25" : "bg-accent-soft text-accent hover:bg-accent/20"
            }`}
          >
            {doc.is_public ? "Public" : "Private"}
          </button>
          {confirming ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onDelete(doc.slug);
                }}
                className="text-[11px] font-medium px-2 py-1 rounded-md bg-bad/15 text-bad hover:bg-bad/25 transition"
              >
                Delete?
              </button>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setConfirming(false);
                }}
                aria-label="Cancel delete"
                className="inline-flex items-center justify-center p-1 rounded-md text-muted hover:text-ink transition"
              >
                &#x2715;
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setConfirming(true);
              }}
              aria-label="Delete doc"
              title="Delete"
              className="inline-flex items-center justify-center p-1 -mr-1 rounded-md text-muted opacity-60 hover:opacity-100 hover:text-bad transition"
            >
              <svg
                width={15}
                height={15}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
