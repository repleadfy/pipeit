import { useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import type { PositionPayload } from "@mpipe/shared";

export function useReadingPosition(slug: string | undefined) {
  const restored = useRef(false);

  // Restore position on mount
  useEffect(() => {
    if (!slug || restored.current) return;
    api<PositionPayload>(`/api/docs/${slug}/position`).then((pos) => {
      if (pos.heading_id) {
        const el = document.getElementById(pos.heading_id);
        if (el) { el.scrollIntoView(); restored.current = true; return; }
      }
      if (pos.scroll_pct > 0) {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, scrollHeight * pos.scroll_pct);
      }
      restored.current = true;
    }).catch(() => {});
  }, [slug]);

  // Save position on scroll (debounced)
  useEffect(() => {
    if (!slug) return;
    let timeout: ReturnType<typeof setTimeout>;

    const handler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const scrollTop = document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPct = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

        // Find nearest heading above viewport
        const headings = document.querySelectorAll("article [id]");
        let headingId: string | undefined;
        for (const el of headings) {
          if (el.getBoundingClientRect().top <= 10) headingId = el.id;
        }

        api(`/api/docs/${slug}/position`, {
          method: "PUT",
          body: JSON.stringify({ scroll_pct: scrollPct, heading_id: headingId }),
        }).catch(() => {});
      }, 2500);
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => { window.removeEventListener("scroll", handler); clearTimeout(timeout); };
  }, [slug]);
}
