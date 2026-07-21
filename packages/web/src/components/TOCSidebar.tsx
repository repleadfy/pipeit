import { useEffect, useState } from "react";
import { CloseIcon } from "./icons.js";

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TOCSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const elements = document.querySelectorAll("article h1, article h2, article h3, article h4");
    setHeadings(
      Array.from(elements).map((el) => ({
        id: el.id,
        text: el.textContent ?? "",
        level: parseInt(el.tagName[1], 10),
      })),
    );
  }, []);

  // Scroll-spy: highlight the heading currently at the top of the viewport.
  // IntersectionObserver, not scroll listeners — fires only on boundary crossings.
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            return;
          }
        }
      },
      // Active band: a strip near the top of the viewport (below the sticky header).
      { rootMargin: "-56px 0px -75% 0px" },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  const items = (onItemClick?: () => void) => (
    <>
      <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted mb-3">On this page</h2>
      {headings.map((h) => {
        const active = h.id === activeId;
        return (
          <a
            key={h.id}
            href={`#${h.id}`}
            onClick={onItemClick}
            aria-current={active ? "location" : undefined}
            className={`block py-1.5 text-sm border-l-2 transition duration-200 ${
              active
                ? "text-accent border-accent font-medium"
                : "text-muted border-hair hover:text-ink hover:border-accent/50"
            }`}
            style={{ paddingLeft: `${12 + (h.level - 1) * 12}px` }}
          >
            {h.text}
          </a>
        );
      })}
    </>
  );

  return (
    <>
      {/* Desktop: persistent sidebar in the left gutter */}
      <nav className="hidden lg:block lg:w-56 lg:shrink-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto print:hidden">
        {items()}
      </nav>

      {/* Mobile: slide-in drawer with scrim */}
      {open && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close table of contents"
            onClick={onClose}
            className="pi-fade fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 cursor-default"
          />
          <nav className="pi-slide-left fixed left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-surface border-r border-hair z-50 overflow-y-auto p-4 pt-4 shadow-2xl shadow-black/10 dark:shadow-black/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">Contents</span>
              <button
                type="button"
                aria-label="Close table of contents"
                onClick={onClose}
                className="min-h-9 min-w-9 -mr-1 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-raise active:scale-95 transition duration-200"
              >
                <CloseIcon size={15} />
              </button>
            </div>
            {items(onClose)}
          </nav>
        </div>
      )}
    </>
  );
}
