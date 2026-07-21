import type { DocResponse } from "@pipeit/shared";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "../components/Header.js";
import { HtmlRenderer } from "../components/HtmlRenderer.js";
import { LogoMark, UploadIcon } from "../components/icons.js";
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

/** ~220 wpm; only meaningful for text formats. */
function readingMinutes(content: string): number {
  return Math.max(1, Math.round(content.split(/\s+/).length / 220));
}

function DocSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 py-8 lg:flex lg:gap-8 lg:items-start"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="hidden lg:block lg:w-56 lg:shrink-0 space-y-3 pt-1">
        <div className="pi-skeleton h-3 w-24" />
        <div className="pi-skeleton h-3 w-40" />
        <div className="pi-skeleton h-3 w-32" />
        <div className="pi-skeleton h-3 w-36" />
      </div>
      <div className="w-full min-w-0 mx-auto lg:max-w-3xl">
        <div className="pi-skeleton h-10 w-3/4 mb-3" />
        <div className="pi-skeleton h-4 w-40 mb-10" />
        <div className="space-y-3">
          <div className="pi-skeleton h-4 w-full" />
          <div className="pi-skeleton h-4 w-[92%]" />
          <div className="pi-skeleton h-4 w-[97%]" />
          <div className="pi-skeleton h-4 w-2/3" />
          <div className="pi-skeleton h-40 w-full mt-6" />
          <div className="pi-skeleton h-4 w-full mt-6" />
          <div className="pi-skeleton h-4 w-[88%]" />
        </div>
      </div>
    </div>
  );
}

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
          <div className="pi-rise text-center space-y-5 max-w-md">
            <LogoMark size={32} className="mx-auto text-ink" />
            <h1 className="font-heading text-3xl font-bold">Welcome to pipeit</h1>
            <p className="text-muted">You don't have any documents yet. Pipe your first one from Claude Code:</p>
            <pre className="text-left bg-raise border border-hair rounded-card p-4 text-sm font-mono text-ink overflow-x-auto">
              /pipeit ./README.md
            </pre>
            <p className="text-muted text-sm">or</p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:opacity-90 active:scale-[0.98] text-on-accent text-sm font-semibold transition duration-200"
            >
              <UploadIcon />
              Upload a file
            </Link>
          </div>
        </div>
      );
    return (
      <div className="min-h-screen flex items-center justify-center bg-app text-ink px-6">
        <div className="pi-rise text-center space-y-4 max-w-sm">
          <LogoMark size={28} className="mx-auto text-muted opacity-60" />
          <p className="font-heading text-xl font-bold">
            {error === "not found" ? "Document not found" : "Something went wrong"}
          </p>
          <p className="text-sm text-muted">
            {error === "not found" ? "This document may have been deleted, or the link is private." : error}
          </p>
          <Link to="/" className="inline-block text-accent hover:opacity-80 text-sm font-medium transition">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (!doc)
    return (
      <div className="min-h-screen bg-app text-ink">
        <DocSkeleton />
      </div>
    );

  const isEmbed = doc.format === "pdf" || doc.format === "html";
  const isText = doc.format === "markdown" || doc.format === "txt";

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
          className={`pi-rise w-full min-w-0 mx-auto print:[display:contents] ${isEmbed ? "lg:max-w-5xl" : "lg:max-w-3xl"}`}
        >
          {/* Embedded docs (PDF/HTML) carry their own heading inside the frame, so
              the app title block is hidden in print to avoid a duplicate title. */}
          <h1
            className={`font-heading text-4xl font-bold leading-tight tracking-tight text-balance mb-2 ${isEmbed ? "print:hidden" : ""}`}
          >
            {doc.title}
          </h1>
          <p className={`text-sm text-muted mb-10 ${isEmbed ? "print:hidden" : ""}`}>
            v{doc.version} &middot;{" "}
            {new Date(doc.updated_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {isText && ` · ${readingMinutes(doc.content)} min read`}
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
