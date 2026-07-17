import type { DocResponse } from "@pipeit/shared";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "../components/Header.js";
import { HtmlRenderer } from "../components/HtmlRenderer.js";
import { MarkdownRenderer } from "../components/MarkdownRenderer.js";
import { ReadingProgress } from "../components/ReadingProgress.js";
import { SearchPanel } from "../components/SearchPanel.js";
import { TOCSidebar } from "../components/TOCSidebar.js";
import { TxtRenderer } from "../components/TxtRenderer.js";
import { useKeyboard } from "../hooks/useKeyboard.js";
import { useReadingPosition } from "../hooks/useReadingPosition.js";
import { useTheme } from "../hooks/useTheme.js";
import { api } from "../lib/api.js";

// pdf.js is heavy (~1MB worker) — only load it when actually viewing a PDF.
const PdfRenderer = lazy(() => import("../components/PdfRenderer.js").then((m) => ({ default: m.PdfRenderer })));

export function DocPage() {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<DocResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const toggleSearch = useCallback(() => setSearchOpen((v) => !v), []);
  const closeOverlays = useCallback(() => {
    setTocOpen(false);
    setSearchOpen(false);
  }, []);
  useKeyboard("k", true, toggleSearch);
  useKeyboard("Escape", false, closeOverlays);
  useReadingPosition(slug);
  const { theme, toggle: toggleTheme, skin, setSkin } = useTheme();

  useEffect(() => {
    if (!slug) return;
    api<DocResponse>(`/api/docs/${slug}`)
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    if (error === "no_docs")
      return (
        <div className="min-h-screen flex items-center justify-center bg-app text-ink px-6">
          <div className="text-center space-y-5 max-w-md">
            <h1 className="font-heading text-3xl font-bold">Welcome to pipeit</h1>
            <p className="text-muted">
              You don't have any documents yet. Push your first markdown file to get started:
            </p>
            <pre className="text-left bg-raise border border-hair rounded-card p-4 text-sm font-mono text-ink overflow-x-auto">
              npx pipeit push README.md
            </pre>
            <p className="text-muted text-sm">or</p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:opacity-90 text-on-accent text-sm font-semibold transition"
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 15V4M12 4 8 8M12 4l4 4" />
                <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
              </svg>
              Upload a file
            </Link>
          </div>
        </div>
      );
    return (
      <div className="min-h-screen flex items-center justify-center bg-app text-ink px-6">
        <div className="text-center">
          <p className="text-muted mb-4">{error === "not found" ? "Document not found" : error}</p>
          <Link to="/" className="text-accent hover:opacity-80 text-sm font-medium">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (!doc)
    return (
      <div className="min-h-screen flex items-center justify-center bg-app text-ink">
        <p className="text-muted">Loading...</p>
      </div>
    );

  const isEmbed = doc.format === "pdf" || doc.format === "html";

  return (
    // print:[display:contents] on the viewer wrapper chain (this div → the
    // centered container → <main>) collapses their boxes when printing. Chrome
    // otherwise inserts a blank leading page before a doc taller than one page
    // that's rendered in an <iframe> (HTML docs); flattening the wrappers lets
    // it paginate the frame from page one.
    <div className="min-h-screen bg-app text-ink print:[display:contents]">
      <Header
        onToggleTOC={() => setTocOpen(!tocOpen)}
        onToggleSearch={() => setSearchOpen(!searchOpen)}
        theme={theme}
        onToggleTheme={toggleTheme}
        skin={skin}
        setSkin={setSkin}
        docTitle={doc.title}
        exportDoc={{ slug: doc.slug, title: doc.title, format: doc.format, content: doc.content }}
      />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <div className="mx-auto max-w-7xl px-4 py-8 lg:flex lg:gap-8 lg:items-start print:[display:contents]">
        <TOCSidebar open={tocOpen} onClose={() => setTocOpen(false)} />
        <main
          className={`w-full min-w-0 mx-auto print:[display:contents] ${isEmbed ? "lg:max-w-5xl" : "lg:max-w-3xl"}`}
        >
          {/* Embedded docs (PDF/HTML) carry their own heading inside the frame, so
              the app title block is hidden in print to avoid a duplicate title. */}
          <h1
            className={`font-heading text-4xl font-bold leading-tight tracking-tight mb-2 ${isEmbed ? "print:hidden" : ""}`}
          >
            {doc.title}
          </h1>
          <p className={`text-sm text-muted mb-10 ${isEmbed ? "print:hidden" : ""}`}>
            v{doc.version} &middot; {new Date(doc.updated_at).toLocaleDateString()}
          </p>
          {doc.format === "pdf" ? (
            <Suspense fallback={<p className="text-muted">Loading PDF viewer…</p>}>
              <PdfRenderer slug={doc.slug} />
            </Suspense>
          ) : doc.format === "html" ? (
            <HtmlRenderer content={doc.content} />
          ) : doc.format === "txt" ? (
            <TxtRenderer content={doc.content} />
          ) : (
            <MarkdownRenderer content={doc.content.replace(/^#\s+.+\n?/, "")} />
          )}
        </main>
      </div>
      <ReadingProgress />
    </div>
  );
}
