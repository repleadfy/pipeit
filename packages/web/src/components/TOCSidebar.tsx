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
    setHeadings(Array.from(elements).map((el) => ({
      id: el.id,
      text: el.textContent ?? "",
      level: parseInt(el.tagName[1]),
    })));
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 z-50 overflow-y-auto p-4 pt-16">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Contents</h2>
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            onClick={onClose}
            className="block py-1 text-sm text-gray-300 hover:text-white transition"
            style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </>
  );
}
