import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertIcon, ArrowLeftIcon, CheckIcon, FileUpIcon, SpinnerIcon } from "../components/icons.js";

const ACCEPT = ".md,.markdown,.txt,.text,.html,.htm,.pdf";
const ACCEPT_HINT = "Markdown, text, HTML, or PDF";
const MAX_BYTES = 25_000_000;

type Item = {
  id: number;
  name: string;
  status: "uploading" | "done" | "error";
  url?: string;
  slug?: string;
  error?: string;
};

let nextItemId = 0;

// Everything goes through the multipart endpoint — the server auto-detects format
// (PDF magic bytes / extension / HTML sniff) and reads text files as UTF-8. One
// code path for all formats.
async function uploadFile(file: File, isPublic: boolean): Promise<{ slug: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("file_path", file.name);
  form.append("is_public", String(isPublic));
  const res = await fetch("/api/docs", { method: "POST", credentials: "include", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ slug: string; url: string }>;
}

export function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      for (const file of list) {
        const id = nextItemId++;
        if (file.size > MAX_BYTES) {
          setItems((prev) => [...prev, { id, name: file.name, status: "error", error: "exceeds 25MB limit" }]);
          continue;
        }
        setItems((prev) => [...prev, { id, name: file.name, status: "uploading" }]);
        try {
          const { slug, url } = await uploadFile(file, isPublic);
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "done", url, slug } : it)));
          // Single-file upload → jump straight to the doc.
          if (list.length === 1) navigate(`/d/${slug}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "upload failed";
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error", error: msg } : it)));
        }
      }
    },
    [isPublic, navigate],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div className="min-h-screen bg-app text-ink">
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 bg-app/80 backdrop-blur border-b border-hair">
        <Link
          to="/d/latest"
          className="inline-flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-raise active:scale-[0.97] transition duration-200"
        >
          <ArrowLeftIcon size={14} />
          Back
        </Link>
        <span className="text-sm font-semibold">Upload</span>
        <span className="w-12" />
      </header>

      <main className="pi-rise max-w-2xl mx-auto px-4 py-10">
        <h1 className="font-heading text-3xl font-bold tracking-tight mb-2">Upload a document</h1>
        <p className="text-sm text-muted mb-6">{ACCEPT_HINT} (up to 25 MB).</p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`group w-full rounded-card border-2 border-dashed px-6 py-16 text-center transition duration-200 cursor-pointer ${
            dragging ? "border-accent bg-accent-soft" : "border-hair hover:border-accent/60 hover:bg-raise/50"
          }`}
        >
          <FileUpIcon
            size={36}
            className={`mx-auto mb-4 transition duration-200 ${dragging ? "text-accent" : "text-muted group-hover:text-accent"}`}
          />
          <p className="text-base font-medium">Tap to choose a file</p>
          <p className="text-sm text-muted mt-1">or drag &amp; drop it here</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </button>

        <label className="flex items-center gap-3 mt-4 min-h-11 text-sm text-muted select-none cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-5 h-5 accent-[var(--pi-accent)]"
          />
          Make uploaded documents public (shareable by link)
        </label>

        {items.length > 0 && (
          <ul className="mt-8 space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="pi-rise flex items-center justify-between gap-3 rounded-xl border border-hair bg-surface px-4 py-3 text-sm"
              >
                <span className="truncate font-medium">{it.name}</span>
                {it.status === "uploading" && (
                  <span className="inline-flex items-center gap-2 text-muted shrink-0">
                    <SpinnerIcon size={13} />
                    Uploading
                  </span>
                )}
                {it.status === "done" && it.slug && (
                  <Link
                    to={`/d/${it.slug}`}
                    className="inline-flex items-center gap-1.5 text-accent hover:opacity-80 shrink-0 font-medium transition"
                  >
                    <CheckIcon size={13} className="text-ok" />
                    Open
                  </Link>
                )}
                {it.status === "error" && (
                  <span className="inline-flex items-center gap-1.5 text-bad shrink-0">
                    <AlertIcon size={13} />
                    {it.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
