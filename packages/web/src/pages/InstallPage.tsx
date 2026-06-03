import { Link } from "react-router-dom";
import { CopyButton } from "../components/CopyButton.js";

const PLUGIN_COMMANDS = `/plugin marketplace add repleadfy/pipeit
/plugin install pipeit@repleadfy`;

function Block({ label, code, recommended }: { label: string; code: string; recommended?: boolean }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted">{label}</h2>
        {recommended && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-soft text-accent">recommended</span>
        )}
        <div className="ml-auto">
          <CopyButton text={code} />
        </div>
      </div>
      <pre className="rounded-card bg-raise border border-hair p-3 text-sm font-mono overflow-x-auto">
        <code>{code}</code>
      </pre>
    </section>
  );
}

export function InstallPage() {
  return (
    <div className="min-h-screen bg-app text-ink">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <header className="space-y-2">
          <h1 className="font-heading text-4xl font-bold tracking-tight">pipeit</h1>
          <p className="text-muted">Share markdown from AI conversations. Read on any device.</p>
        </header>

        <Block label="Claude Code plugin" code={PLUGIN_COMMANDS} recommended />
        <Block label="npm" code="npx pipeit.live" />
        <Block label="Bun" code="bunx pipeit.live" />

        <p className="text-sm text-muted">
          After install: run <code className="font-mono text-ink">/pipeit</code> in Claude Code. Your browser opens once
          to sign in.
        </p>

        <p className="text-sm text-muted">
          Already installed?{" "}
          <Link to="/login" className="text-accent hover:opacity-80 font-medium">
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
