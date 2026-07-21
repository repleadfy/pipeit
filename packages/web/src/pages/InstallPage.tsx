import { useState } from "react";
import { Link } from "react-router-dom";
import { CopyButton } from "../components/CopyButton.js";
import { ArrowRightIcon, GithubIcon, LogoMark } from "../components/icons.js";

const TABS = [
  {
    id: "claude",
    label: "Claude Code",
    recommended: true,
    lines: ["/plugin marketplace add repleadfy/pipeit", "/plugin install pipeit@repleadfy"],
  },
  { id: "npm", label: "npm", recommended: false, lines: ["npx pipeit.live"] },
  { id: "bun", label: "Bun", recommended: false, lines: ["bunx pipeit.live"] },
] as const;

const STEPS = [
  { n: "1", title: "Install", body: "Add the plugin to Claude Code.", code: "/plugin install pipeit" },
  { n: "2", title: "Pipe", body: "Run it on any doc in your chat.", code: "/pipeit ./file.md" },
  { n: "3", title: "Read", body: "Open the link anywhere. TOC, search, dark mode, progress sync." },
];

/** Three vertical bars a value flows through — the pipe made literal. */
function PipeConnector() {
  return (
    <span className="inline-flex items-end gap-[3px] h-4 text-accent" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="pi-flow-bar w-[3px] rounded-full bg-current"
          style={{ height: i === 1 ? "100%" : "70%", animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

function InstallCard() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("claude");
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const copyText = current.lines.join("\n");

  return (
    <div className="rounded-card border border-hair bg-surface overflow-hidden shadow-sm shadow-black/[0.04] dark:shadow-black/20">
      {/* Terminal chrome: tabs on the left, copy on the right. */}
      <div className="flex items-center gap-1 border-b border-hair bg-raise/50 px-2 py-1.5">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-label={t.recommended ? `${t.label} (recommended)` : t.label}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition duration-200 ${
                active ? "bg-surface text-ink shadow-sm shadow-black/[0.04]" : "text-muted hover:text-ink"
              }`}
            >
              {t.recommended && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
              {t.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <CopyButton text={copyText} />
        </div>
      </div>
      {/* Command lines, each with an accent prompt glyph. */}
      <div className="px-4 py-4 font-mono text-sm overflow-x-auto">
        {current.lines.map((line) => (
          <div key={line} className="flex gap-3 whitespace-pre leading-relaxed">
            <span className="select-none text-accent" aria-hidden="true">
              ›
            </span>
            <span className="text-ink">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InstallPage() {
  return (
    <div className="min-h-screen bg-app text-ink">
      {/* Nav: wordmark lockup left, secondary links right. */}
      <header className="sticky top-0 z-40 bg-app/80 backdrop-blur border-b border-hair">
        <nav className="max-w-3xl mx-auto flex items-center gap-3 px-6 py-3">
          <span className="inline-flex items-center gap-1.5 font-heading font-bold tracking-tight">
            <LogoMark size={16} className="translate-y-px" />
            pipeit
          </span>
          <div className="flex-1" />
          <a
            href="https://github.com/repleadfy/pipeit"
            target="_blank"
            rel="noreferrer"
            aria-label="pipeit on GitHub"
            className="inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg text-muted hover:text-ink hover:bg-raise active:scale-[0.97] transition duration-200"
          >
            <GithubIcon size={18} />
          </a>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 rounded-lg bg-ink text-app px-3 py-1.5 text-sm font-medium hover:opacity-90 active:scale-[0.98] transition duration-200"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main className="pi-rise max-w-3xl mx-auto px-6 py-16 sm:py-24">
        {/* Hero: the headline sells the value, not the name. */}
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent mb-4">Claude Code plugin</p>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-balance">
            Pipe docs out of your AI chats.
          </h1>
          <p className="mt-5 text-lg text-muted text-pretty">
            One command turns any markdown, code, PDF, or HTML block into a clean link you can read on your phone or
            hand to a teammate. No copy-paste through tokens.
          </p>
        </div>

        {/* Signature visual: the flow itself, input command to output URL. */}
        <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-sm">
          <span className="rounded-lg border border-hair bg-raise px-3 py-1.5 text-ink">/pipeit ./spec.md</span>
          <span className="inline-flex items-center gap-1.5 text-accent">
            <PipeConnector />
            <ArrowRightIcon size={14} />
          </span>
          <span className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-accent">
            pipeit.live/d/x9k2
          </span>
        </div>

        {/* Install command block with terminal chrome + tabs. */}
        <div className="mt-12">
          <InstallCard />
          <p className="mt-3 text-sm text-muted">
            First run opens your browser once to sign in. After that, the token stays on your machine.
          </p>
        </div>

        {/* How it flows — three steps, because the flow is the product. */}
        <div className="mt-16 grid gap-8 sm:grid-cols-3 border-t border-hair pt-10">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="font-heading text-2xl font-bold text-accent leading-none mb-3">{s.n}</div>
              <h2 className="text-sm font-semibold text-ink mb-1">{s.title}</h2>
              <p className="text-sm text-muted">{s.body}</p>
              {s.code && (
                <code className="mt-2 inline-block font-mono text-xs text-ink bg-raise border border-hair rounded-md px-1.5 py-0.5">
                  {s.code}
                </code>
              )}
            </div>
          ))}
        </div>

        <p className="mt-16 text-sm text-muted">
          Already installed?{" "}
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-accent hover:opacity-80 font-medium transition"
          >
            Sign in
            <ArrowRightIcon size={13} />
          </Link>
        </p>
      </main>
    </div>
  );
}
