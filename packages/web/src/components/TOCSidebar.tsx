import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TOCSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [headings, setHeadings] = useState<Heading[]>([]);

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

  if (headings.length === 0) return null;

  const items = (onItemClick?: () => void) => (
    <>
      <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted mb-3">On this page</h2>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={onItemClick}
          className="block py-1.5 text-sm text-muted hover:text-ink border-l-2 border-hair hover:border-accent transition"
          style={{ paddingLeft: `${12 + (h.level - 1) * 12}px` }}
        >
          {h.text}
        </a>
      ))}
    </>
  );

  return (
    <>
      {/* Desktop: persistent sidebar in the left gutter */}
      <nav className="hidden lg:block lg:w-56 lg:shrink-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        {items()}
      </nav>

      {/* Mobile: slide-in drawer with scrim */}
      {open && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close table of contents"
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 cursor-default"
          />
          <nav className="fixed left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-surface border-r border-hair z-50 overflow-y-auto p-4 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">Contents</span>
              <button
                type="button"
                aria-label="Close table of contents"
                onClick={onClose}
                className="min-h-9 min-w-9 -mr-1 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-raise transition"
              >
                &#x2715;
              </button>
            </div>
            {items(onClose)}
          </nav>
        </div>
      )}
    </>
  );
}
