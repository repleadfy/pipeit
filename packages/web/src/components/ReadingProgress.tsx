import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const scrollTop = document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Thin top rail. Track is transparent so it never reads as a stray rule;
  // only the accent fill is visible.
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none">
      <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
    </div>
  );
}
