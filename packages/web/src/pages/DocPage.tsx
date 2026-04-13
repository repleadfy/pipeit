import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Header } from "../components/Header.js";
import { MarkdownRenderer } from "../components/MarkdownRenderer.js";
import { ReadingProgress } from "../components/ReadingProgress.js";
import type { DocResponse } from "@mpipe/shared";

export function DocPage() {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<DocResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api<DocResponse>(`/api/docs/${slug}`)
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <p className="text-gray-400">{error === "not found" ? "Document not found" : error}</p>
    </div>
  );

  if (!doc) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header onToggleTOC={() => setTocOpen(!tocOpen)} onToggleSearch={() => setSearchOpen(!searchOpen)} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        <p className="text-sm text-gray-500 mb-8">v{doc.version} &middot; {new Date(doc.updated_at).toLocaleDateString()}</p>
        <MarkdownRenderer content={doc.content} />
      </main>
      <ReadingProgress />
    </div>
  );
}
