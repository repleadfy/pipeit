import type { DocListItem as DocItem } from "@pipeit/shared";
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { CycleFilter } from "./CycleFilter.js";
import { DocListItem } from "./DocListItem.js";

const READ_STATES = ["All", "Not started", "Reading", "Finished"];
const VISIBILITY = ["All", "Private", "Public"];

function readStateParam(v: string): string | undefined {
  if (v === "Not started") return "not_started";
  if (v === "Reading") return "reading";
  if (v === "Finished") return "finished";
  return undefined;
}

export function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [query, setQuery] = useState("");
  const [readState, setReadState] = useState("All");
  const [visibility, setVisibility] = useState("All");

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const rs = readStateParam(readState);
    if (rs) params.set("read_state", rs);
    if (visibility === "Private") params.set("visibility", "private");
    if (visibility === "Public") params.set("visibility", "public");

    api<DocItem[]>(`/api/docs?${params}`)
      .then(setDocs)
      .catch(() => {});
  }, [open, query, readState, visibility]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close search panel"
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-40 cursor-default"
      />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[26rem] max-w-full bg-surface border-l border-hair z-50 flex flex-col shadow-xl">
        <div className="p-3 border-b border-hair space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Your Docs</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-raise transition"
            >
              &#x2715;
            </button>
          </div>
          <input
            type="text"
            placeholder="Search docs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-raise border border-hair text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <CycleFilter label="📖" options={READ_STATES} value={readState} onChange={setReadState} />
            <CycleFilter label="🔒" options={VISIBILITY} value={visibility} onChange={setVisibility} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {docs.map((doc) => (
            <DocListItem key={doc.slug} doc={doc} />
          ))}
          {docs.length === 0 && <p className="text-sm text-muted text-center mt-8">No docs found</p>}
        </div>
      </div>
    </>
  );
}
