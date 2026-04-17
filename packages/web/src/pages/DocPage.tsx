import { useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Header } from "../components/Header.js";
import { MarkdownRenderer } from "../components/MarkdownRenderer.js";
import { ReadingProgress } from "../components/ReadingProgress.js";
import { TOCSidebar } from "../components/TOCSidebar.js";
import { SearchPanel } from "../components/SearchPanel.js";
import { useKeyboard } from "../hooks/useKeyboard.js";
import { useReadingPosition } from "../hooks/useReadingPosition.js";
import { useTheme } from "../hooks/useTheme.js";
import type { DocResponse } from "@mpipe/shared";

export function DocPage() {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<DocResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const toggleSearch = useCallback(() => setSearchOpen((v) => !v), []);
  useKeyboard("k", true, toggleSearch);
  useReadingPosition(slug);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    if (!slug) return;
    api<DocResponse>(`/api/docs/${slug}`)
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    if (error === "no_docs") return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Welcome to mpipe</h1>
          <p className="text-gray-400">You don't have any documents yet. Push your first markdown file to get started:</p>
          <pre className="text-left bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">npx mpipe push README.md</pre>
        </div>
      </div>
    );
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <p className="text-gray-400">{error === "not found" ? "Document not found" : error}</p>
      </div>
    );
  }

  if (!doc) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Header onToggleTOC={() => setTocOpen(!tocOpen)} onToggleSearch={() => setSearchOpen(!searchOpen)} theme={theme} onToggleTheme={toggleTheme} />
      <TOCSidebar open={tocOpen} onClose={() => setTocOpen(false)} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        <p className="text-sm text-gray-500 mb-8">v{doc.version} &middot; {new Date(doc.updated_at).toLocaleDateString()}</p>
        <MarkdownRenderer content={doc.content.replace(/^#\s+.+\n?/, "")} />
      </main>
      <ReadingProgress />
    </div>
  );
}
