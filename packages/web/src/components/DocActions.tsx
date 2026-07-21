import type { DocFormat } from "@pipeit/shared";
import { useEffect, useRef, useState } from "react";
import { DownloadIcon } from "./icons.js";

const EXT: Record<DocFormat, string> = { markdown: "md", txt: "txt", html: "html", pdf: "pdf" };
const MIME: Partial<Record<DocFormat, string>> = {
  markdown: "text/markdown",
  txt: "text/plain",
  html: "text/html",
};
const COPY_LABEL: Partial<Record<DocFormat, string>> = {
  markdown: "Copy markdown",
  txt: "Copy text",
  html: "Copy HTML",
};

const ghost =
  "inline-flex items-center justify-center min-h-9 px-2.5 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-raise active:scale-[0.97] transition duration-200";
const item =
  "w-full text-left px-2 py-2 text-sm text-muted hover:bg-raise hover:text-ink transition duration-200 rounded-lg";

// Filesystem-safe name from the doc title (keep letters/numbers/space/._-), else slug.
function filename(title: string, slug: string, format: DocFormat): string {
  const base =
    title
      .trim()
      .replace(/[^\p{L}\p{N} ._-]/gu, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || slug;
  return `${base}.${EXT[format]}`;
}

interface Props {
  slug: string;
  title: string;
  format: DocFormat;
  content: string;
}

/** Take-the-doc-with-you actions: copy the source, download a file, or print
 *  (which doubles as "save as PDF" via the browser dialog). Available to any
 *  reader — the doc viewer is public. */
export function DocActions({ slug, title, format, content }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const canCopy = format !== "pdf";

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (e.g. insecure context) — no-op */
    }
  }

  function download() {
    const a = document.createElement("a");
    let objectUrl: string | null = null;
    if (format === "pdf") {
      // Binary lives at the raw endpoint; the download attr forces attachment.
      a.href = `/api/docs/${slug}/raw`;
    } else {
      const blob = new Blob([content], { type: MIME[format] ?? "text/plain" });
      objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
    }
    a.download = filename(title, slug, format);
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setOpen(false);
  }

  return (
    <div className="relative print:hidden" ref={ref}>
      <button type="button" aria-label="Export document" onClick={() => setOpen(!open)} className={ghost}>
        <DownloadIcon />
      </button>
      {open && (
        <div className="pi-pop absolute right-0 mt-2 w-52 bg-surface border border-hair rounded-xl shadow-xl shadow-black/5 dark:shadow-black/30 py-1 px-1 z-50">
          {canCopy && (
            <button type="button" className={item} onClick={copy}>
              {copied ? "Copied" : COPY_LABEL[format]}
            </button>
          )}
          <button type="button" className={item} onClick={download}>
            Download .{EXT[format]}
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              window.print();
            }}
          >
            Print / Save as PDF
          </button>
        </div>
      )}
    </div>
  );
}
