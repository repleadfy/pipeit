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
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Contents</h2>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={onItemClick}
          className="block py-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition"
          style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
        >
          {h.text}
        </a>
      ))}
    </>
  );

  return (
    <>
      {/* Desktop: persistent sidebar in the left gutter */}
      <nav className="hidden lg:block lg:w-56 lg:shrink-0 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
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
          <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 overflow-y-auto p-4 pt-16">
            {items(onClose)}
          </nav>
        </div>
      )}
    </>
  );
}
