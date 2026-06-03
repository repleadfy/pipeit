import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Renders PDFs with pdf.js into stacked <canvas> pages instead of relying on the
 * browser's native PDF viewer (an <iframe src=...pdf>). The native viewer is
 * absent on most mobile browsers and in headless Chromium — `navigator.pdfViewerEnabled`
 * is false there — which is fatal for a "read on any device" product. pdf.js paints
 * to canvas identically everywhere. Bytes come from the raw endpoint over a
 * same-origin request, so cookie auth keeps private PDFs private.
 */
export function PdfRenderer({ slug }: { slug: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawUrl = `/api/docs/${slug}/raw`;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      try {
        const res = await fetch(rawUrl, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.arrayBuffer();
        if (cancelled) return;

        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        container.replaceChildren();
        // Render at 2x for crispness on retina, then scale down via CSS to fit width.
        const targetWidth = container.clientWidth || 800;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (targetWidth / baseViewport.width) * (window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mx-auto mb-4 max-w-full h-auto rounded-lg shadow border border-hair";
          canvas.style.width = "100%";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          container.appendChild(canvas);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "failed to render PDF");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawUrl]);

  return (
    <div>
      {status === "loading" && <p className="text-muted">Rendering PDF…</p>}
      {status === "error" && (
        <p className="text-bad">
          Couldn't render PDF ({error}).{" "}
          <a href={rawUrl} target="_blank" rel="noreferrer" className="underline">
            Open original ↗
          </a>
        </p>
      )}
      <div ref={containerRef} />
      <p className="mt-4 text-sm text-muted">
        <a href={rawUrl} target="_blank" rel="noreferrer" className="text-accent hover:opacity-80">
          Open original PDF ↗
        </a>
      </p>
    </div>
  );
}
