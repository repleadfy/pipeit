import type { DocListItem as DocItem } from "@pipeit/shared";
import { Link } from "react-router-dom";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

export function DocListItem({ doc }: { doc: DocItem }) {
  const pct = doc.read_pct ?? 0;
  const pctColor = pct >= 1 ? "text-ok" : pct > 0 ? "text-warn" : "text-muted";
  const barColor = pct >= 1 ? "bg-ok" : pct > 0 ? "bg-warn" : "bg-hair";

  return (
    <Link
      to={`/d/${doc.slug}`}
      className="block p-3 rounded-lg bg-raise/60 border border-hair hover:border-accent/50 transition mb-2"
    >
      <div className="font-medium text-sm text-ink mb-1 truncate">{doc.title}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          v{doc.version} &middot; {timeAgo(doc.updated_at)}
        </span>
        <div className="flex items-center gap-2">
          <span className={pctColor}>{Math.round(pct * 100)}%</span>
          <div className="w-6 h-1 bg-hair rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct * 100}%` }} />
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              doc.is_public ? "bg-ok/15 text-ok" : "bg-accent-soft text-accent"
            }`}
          >
            {doc.is_public ? "pub" : "priv"}
          </span>
        </div>
      </div>
    </Link>
  );
}
