import type { DocListItem as DocItem } from "@pipeit/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CopyButton } from "../components/CopyButton.js";
import { CycleFilter } from "../components/CycleFilter.js";
import { FormatBadge } from "../components/FormatBadge.js";
import { Header } from "../components/Header.js";
import { HomeDocCard } from "../components/HomeDocCard.js";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CloseIcon,
  LockIcon,
  LogoMark,
  SearchIcon,
  UploadIcon,
} from "../components/icons.js";
import { useKeyboard } from "../hooks/useKeyboard.js";
import { useTheme } from "../hooks/useTheme.js";
import { api } from "../lib/api.js";

const PIPE_COMMAND = "/pipeit ./file.md";

const READ_STATES = ["All", "Not started", "Reading", "Finished"];
const VISIBILITY = ["All", "Private", "Public"];

/** read_pct → coarse read state, mirroring the server's derivation. */
function readState(pct: number | null): "not_started" | "reading" | "finished" {
  if (pct === null || pct === 0) return "not_started";
  if (pct >= 1) return "finished";
  return "reading";
}

/** The command block that starts every value loop: pipe a file from the CLI. */
function CommandBlock({ size = "sm" }: { size?: "sm" | "lg" }) {
  const pad = size === "lg" ? "px-4 py-3 text-base" : "px-3 py-2 text-sm";
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-hair bg-surface ${pad}`}>
      <code className="font-mono whitespace-nowrap">
        <span className="text-accent">/pipeit</span> <span className="text-ink">./file.md</span>
      </code>
      <div className="ml-auto">
        <CopyButton text={PIPE_COMMAND} />
      </div>
    </div>
  );
}

/** Featured card for a doc the reader left partway through. Warmer and larger
 *  than a library cell, since resuming a read is job #1. */
function ContinueCard({ doc }: { doc: DocItem }) {
  const pct = Math.round((doc.read_pct ?? 0) * 100);
  return (
    <Link
      to={`/d/${doc.slug}`}
      className="group flex w-72 shrink-0 snap-start flex-col justify-between gap-5 rounded-card border border-hair bg-raise/50 p-5 transition hover:border-accent/40 hover:bg-raise"
    >
      <div className="space-y-2.5">
        <FormatBadge format={doc.format} />
        <h3 className="font-heading text-lg font-semibold leading-snug text-ink line-clamp-2">{doc.title}</h3>
      </div>
      <div className="space-y-2">
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-hair">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="tabular-nums text-muted">{pct}% read</span>
          <span className="inline-flex items-center gap-1 font-medium text-accent">
            Resume reading
            <ArrowRightIcon size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums font-semibold text-ink">{value}</span> <span className="text-muted">{label}</span>
    </span>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-card bg-raise/40 p-4">
      <div className="pi-skeleton h-5 w-3/4" />
      <div className="pi-skeleton h-0.5 w-full" />
      <div className="flex items-center justify-between">
        <div className="pi-skeleton h-3 w-20" />
        <div className="pi-skeleton h-3 w-24" />
      </div>
    </div>
  );
}

export function HomePage() {
  const { theme, toggle: toggleTheme, skin, setSkin } = useTheme();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [read, setRead] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const searchRef = useRef<HTMLInputElement>(null);

  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useKeyboard("k", true, focusSearch);

  useEffect(() => {
    let stale = false;
    api<DocItem[]>("/api/docs")
      .then((d) => {
        if (!stale) setDocs(d);
      })
      .catch((e) => {
        if (!stale) setError(e.message);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, []);

  const handleToggle = useCallback(async (slug: string, next: boolean) => {
    setDocs((prev) => prev.map((d) => (d.slug === slug ? { ...d, is_public: next } : d)));
    try {
      await api(`/api/docs/${slug}`, { method: "PATCH", body: JSON.stringify({ is_public: next }) });
    } catch {
      setDocs((prev) => prev.map((d) => (d.slug === slug ? { ...d, is_public: !next } : d)));
    }
  }, []);

  const handleDelete = useCallback(async (slug: string) => {
    let prev: DocItem[] = [];
    setDocs((cur) => {
      prev = cur;
      return cur.filter((d) => d.slug !== slug);
    });
    try {
      await api(`/api/docs/${slug}`, { method: "DELETE" });
    } catch {
      setDocs(prev);
    }
  }, []);

  // The library list is filtered client-side off a single unfiltered fetch, so
  // the stats and "Continue reading" rail always reflect true totals, never the
  // active filter. (Full-text body search stays in the ⌘K panel on doc pages.)
  const reading = useMemo(() => docs.filter((d) => readState(d.read_pct) === "reading"), [docs]);
  const publicCount = useMemo(() => docs.filter((d) => d.is_public).length, [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (q && !d.title.toLowerCase().includes(q)) return false;
      if (read === "Not started" && readState(d.read_pct) !== "not_started") return false;
      if (read === "Reading" && readState(d.read_pct) !== "reading") return false;
      if (read === "Finished" && readState(d.read_pct) !== "finished") return false;
      if (visibility === "Public" && !d.is_public) return false;
      if (visibility === "Private" && d.is_public) return false;
      return true;
    });
  }, [docs, query, read, visibility]);

  const anyFilter = query.trim() !== "" || read !== "All" || visibility !== "All";

  return (
    <div className="min-h-[100dvh] bg-app text-ink">
      <Header theme={theme} onToggleTheme={toggleTheme} skin={skin} setSkin={setSkin} />

      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {error ? (
          <div className="pi-rise mx-auto mt-16 max-w-sm text-center space-y-4">
            <LogoMark size={28} className="mx-auto text-muted opacity-60" />
            <p className="font-heading text-xl font-bold">Something went wrong</p>
            <p className="text-sm text-muted">{error}</p>
          </div>
        ) : loading ? (
          <>
            <div className="pi-skeleton h-9 w-48 mb-8" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </>
        ) : docs.length === 0 ? (
          // First run: fold the onboarding welcome into the home itself.
          <div className="pi-rise mx-auto mt-10 max-w-md text-center space-y-6">
            <LogoMark size={36} className="mx-auto text-ink" />
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome to pipeit</h1>
              <p className="text-muted">
                Your library is empty. Pipe your first doc straight from Claude Code, or upload a file.
              </p>
            </div>
            <CommandBlock size="lg" />
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent hover:opacity-90 active:scale-[0.98] transition duration-200"
              >
                <UploadIcon />
                Upload a file
              </Link>
              <Link to="/install" className="text-sm font-medium text-muted hover:text-ink transition">
                Set up the plugin
              </Link>
            </div>
          </div>
        ) : (
          <div className="pi-rise">
            {/* Action band: who you are + how to add, side by side. */}
            <div className="mb-12 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">Your library</h1>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <StatChip value={docs.length} label={docs.length === 1 ? "doc" : "docs"} />
                  <span className="h-3 w-px bg-hair" />
                  <StatChip value={publicCount} label="public" />
                  <span className="h-3 w-px bg-hair" />
                  <StatChip value={reading.length} label="reading" />
                </div>
              </div>
              <CommandBlock />
            </div>

            {/* Continue reading: pick up where you left off (job #1, done right). */}
            {reading.length > 0 && (
              <section className="mb-12">
                <h2 className="mb-4 text-sm font-semibold text-ink">Continue reading</h2>
                <div className="flex snap-x gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                  {reading.map((doc) => (
                    <ContinueCard key={doc.slug} doc={doc} />
                  ))}
                </div>
              </section>
            )}

            {/* The full library. */}
            <section>
              <h2 className="mb-4 text-sm font-semibold text-ink">All docs</h2>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <SearchIcon
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your docs"
                    aria-label="Search your docs by title"
                    className="w-full rounded-lg border border-hair bg-raise py-2.5 pl-9 pr-9 text-sm text-ink placeholder:text-muted transition duration-200 focus:border-accent focus:bg-surface focus:outline-none"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-muted hover:text-ink transition"
                    >
                      <CloseIcon size={14} />
                    </button>
                  ) : (
                    <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-hair bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline-block">
                      &#x2318;K
                    </kbd>
                  )}
                </div>
                <div className="flex gap-2">
                  <CycleFilter
                    label={<BookmarkIcon size={13} />}
                    name="Read state"
                    options={READ_STATES}
                    value={read}
                    onChange={setRead}
                  />
                  <CycleFilter
                    label={<LockIcon size={13} />}
                    name="Visibility"
                    options={VISIBILITY}
                    value={visibility}
                    onChange={setVisibility}
                  />
                </div>
              </div>

              {filtered.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((doc) => (
                    <HomeDocCard key={doc.slug} doc={doc} onToggle={handleToggle} onDelete={handleDelete} />
                  ))}
                </div>
              ) : (
                <div className="mt-12 space-y-2 text-center">
                  <SearchIcon size={22} className="mx-auto text-muted opacity-50" />
                  <p className="text-sm font-medium text-ink">No docs match</p>
                  <p className="mx-auto max-w-[16rem] text-xs text-muted">
                    Try a different search or reset the filters.
                  </p>
                  {anyFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setRead("All");
                        setVisibility("All");
                      }}
                      className="text-xs font-medium text-accent hover:opacity-80 transition"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
