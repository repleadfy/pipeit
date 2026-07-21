import type { DocListItem as DocItem } from "@pipeit/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import { timeAgo } from "../lib/time.js";
import { FormatBadge } from "./FormatBadge.js";
import { CloseIcon, TrashIcon } from "./icons.js";

/** read_pct → a plain-language reading state + its tone. Editorial cards name the
 *  state ("Reading") instead of leaning on a bare number. */
function status(pct: number | null): { label: string; tone: string } {
  if (pct === null || pct === 0) return { label: "Not started", tone: "text-muted" };
  if (pct >= 1) return { label: "Finished", tone: "text-ok" };
  return { label: "Reading", tone: "text-accent" };
}

/** Editorial doc row for the home library: a borderless cell with a serif title,
 *  a hairline progress spine, and controls that stay quiet until hover. Distinct
 *  from the compact DocListItem used in the ⌘K panel. */
export function HomeDocCard({
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
  const st = status(doc.read_pct);

  // Controls live inside the <Link>, so suppress navigation on their clicks.
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      to={`/d/${doc.slug}`}
      className="group flex flex-col gap-3 rounded-card bg-raise/40 p-4 transition hover:bg-raise"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-heading text-lg font-semibold leading-snug text-ink line-clamp-2 group-hover:text-accent transition">
          {doc.title}
        </h3>
        <FormatBadge format={doc.format} className="mt-1" />
      </div>

      {/* Hairline progress spine. */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-hair">
        <div
          className={`h-full rounded-full ${pct >= 1 ? "bg-ok" : "bg-accent"}`}
          style={{ width: `${Math.max(pct, 0) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={st.tone}>{st.label}</span>
          {pct > 0 && (
            <>
              <span className="text-hair">&middot;</span>
              <span className="tabular-nums">{Math.round(pct * 100)}%</span>
            </>
          )}
        </span>

        <span className="flex items-center gap-2.5">
          <span className="whitespace-nowrap">
            v{doc.version} <span className="text-hair">&middot;</span> {timeAgo(doc.updated_at)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onToggle(doc.slug, !doc.is_public);
            }}
            aria-label={`Make ${doc.is_public ? "private" : "public"}`}
            title={`Make ${doc.is_public ? "private" : "public"}`}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
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
                className="rounded-md bg-bad/15 px-2 py-1 text-[11px] font-medium text-bad transition hover:bg-bad/25"
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
                className="inline-flex items-center justify-center rounded-md p-1 text-muted transition hover:text-ink"
              >
                <CloseIcon size={13} />
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
              className="inline-flex items-center justify-center rounded-md p-1 text-muted opacity-60 transition hover:text-bad hover:opacity-100 focus-visible:opacity-100"
            >
              <TrashIcon size={15} />
            </button>
          )}
        </span>
      </div>
    </Link>
  );
}
