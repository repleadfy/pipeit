import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { DocListItem } from "./DocListItem.js";
import { CycleFilter } from "./CycleFilter.js";
import type { DocListItem as DocItem } from "@mpipe/shared";

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

    api<DocItem[]>(`/api/docs?${params}`).then(setDocs).catch(() => {});
  }, [open, query, readState, visibility]);

  if (!open) return null;

  return (
    <>
      <div className="hidden md:block fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full md:w-96 bg-gray-900 border-l border-gray-800 z-50 flex flex-col">
        <div className="p-3 border-b border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Your Docs</h2>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300">&#x2715;</button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search docs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder-gray-500"
              autoFocus
            />
            <CycleFilter options={READ_STATES} value={readState} onChange={setReadState} />
            <CycleFilter options={VISIBILITY} value={visibility} onChange={setVisibility} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {docs.map((doc) => <DocListItem key={doc.slug} doc={doc} />)}
          {docs.length === 0 && <p className="text-sm text-gray-500 text-center mt-8">No docs found</p>}
        </div>
      </div>
    </>
  );
}
