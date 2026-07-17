import type { DocListItem as DocItem } from "@pipeit/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { CycleFilter } from "./CycleFilter.js";
import { DocListItem } from "./DocListItem.js";
import { BookmarkIcon, CloseIcon, LockIcon, SearchIcon } from "./icons.js";

const READ_STATES = ["All", "Not started", "Reading", "Finished"];
const VISIBILITY = ["All", "Private", "Public"];

function readStateParam(v: string): string | undefined {
  if (v === "Not started") return "not_started";
  if (v === "Reading") return "reading";
  if (v === "Finished") return "finished";
  return undefined;
}

function SkeletonRow() {
  return (
    <div className="px-3.5 py-3 rounded-xl border border-hair mb-2">
      <div className="pi-skeleton h-4 w-3/4 mb-3" />
      <div className="flex items-center justify-between">
        <div className="pi-skeleton h-3 w-16" />
        <div className="pi-skeleton h-3 w-24" />
      </div>
    </div>
  );
}

export function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [readState, setReadState] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const rs = readStateParam(readState);
    if (rs) params.set("read_state", rs);
    if (visibility === "Private") params.set("visibility", "private");
    if (visibility === "Public") params.set("visibility", "public");

    let stale = false;
    api<DocItem[]>(`/api/docs?${params}`)
      .then((d) => {
        if (!stale) setDocs(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [open, query, readState, visibility]);

  async function handleToggle(slug: string, next: boolean) {
    // Optimistic: flip locally, revert on failure.
    setDocs((prev) => prev.map((d) => (d.slug === slug ? { ...d, is_public: next } : d)));
    try {
      await api(`/api/docs/${slug}`, { method: "PATCH", body: JSON.stringify({ is_public: next }) });
    } catch {
      setDocs((prev) => prev.map((d) => (d.slug === slug ? { ...d, is_public: !next } : d)));
    }
  }

  async function handleDelete(slug: string) {
    const prev = docs;
    setDocs((cur) => cur.filter((d) => d.slug !== slug));
    try {
      await api(`/api/docs/${slug}`, { method: "DELETE" });
    } catch {
      setDocs(prev); // restore on failure
    }
  }

  if (!open) return null;

  const filtered = query || readState !== "All" || visibility !== "All";

  return (
    <>
      <button
        type="button"
        aria-label="Close search panel"
        onClick={onClose}
        className="pi-fade fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 cursor-default"
      />
      <div className="pi-slide-right fixed top-0 right-0 bottom-0 w-full sm:w-[28rem] max-w-full bg-surface border-l border-hair z-50 flex flex-col shadow-2xl shadow-black/10 dark:shadow-black/40">
        <div className="px-4 pt-4 pb-3 border-b border-hair space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Your docs</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-raise active:scale-95 transition duration-200"
            >
              <CloseIcon size={15} />
            </button>
          </div>
          <div className="relative">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by title or content"
              aria-label="Search docs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-raise border border-hair text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent focus:bg-surface transition duration-200"
            />
          </div>
          <div className="flex gap-2">
            <CycleFilter
              label={<BookmarkIcon size={13} />}
              name="Read state"
              options={READ_STATES}
              value={readState}
              onChange={setReadState}
            />
            <CycleFilter
              label={<LockIcon size={13} />}
              name="Visibility"
              options={VISIBILITY}
              value={visibility}
              onChange={setVisibility}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && docs.length === 0 ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : (
            <>
              {docs.map((doc) => (
                <DocListItem key={doc.slug} doc={doc} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
              {docs.length === 0 && (
                <div className="text-center mt-12 space-y-2">
                  <SearchIcon size={22} className="mx-auto text-muted opacity-50" />
                  <p className="text-sm font-medium text-ink">No docs found</p>
                  <p className="text-xs text-muted max-w-[16rem] mx-auto">
                    {filtered
                      ? "Try a different search or reset the filters."
                      : "Run /pipeit in Claude Code or upload a file to get started."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
