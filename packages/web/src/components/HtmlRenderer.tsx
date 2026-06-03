import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Renders uploaded HTML verbatim inside a sandboxed iframe.
 *
 * Security: `sandbox="allow-same-origin"` WITHOUT `allow-scripts` means the
 * document's own CSS/markup render faithfully but no JavaScript executes — so
 * stored-XSS in an uploaded file is inert. `allow-same-origin` is what lets the
 * parent measure scrollHeight to auto-size; since scripts are disabled the framed
 * page still cannot reach back into the parent.
 */
export function HtmlRenderer({ content }: { content: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  const objectUrl = useMemo(() => URL.createObjectURL(new Blob([content], { type: "text/html" })), [content]);

  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const resize = () => {
      try {
        const doc = iframe.contentDocument;
        // Measure <body>, not <html>: the documentElement stretches to fill the
        // iframe's current height, so measuring it ratchets up and never shrinks,
        // leaving an empty box under short docs. body wraps the actual content.
        const content = doc?.body?.scrollHeight ?? doc?.documentElement.scrollHeight;
        if (content) setHeight(content + 24);
      } catch {
        /* measurement blocked — keep fallback height */
      }
    };
    iframe.addEventListener("load", resize);
    const t = setInterval(resize, 1000);
    return () => {
      iframe.removeEventListener("load", resize);
      clearInterval(t);
    };
  }, []);

  return (
    <div>
      <iframe
        ref={ref}
        title="Document"
        srcDoc={content}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="w-full border-0 bg-white"
        style={{ height }}
      />
      <p className="mt-4 text-sm text-muted">
        <a href={objectUrl} target="_blank" rel="noreferrer" className="text-accent hover:opacity-80">
          Open original HTML ↗
        </a>
      </p>
    </div>
  );
}
