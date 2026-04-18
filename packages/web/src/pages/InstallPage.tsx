import { Link } from "react-router-dom";
import { CopyButton } from "../components/CopyButton.js";

const PLUGIN_COMMANDS = `/plugin marketplace add repleadfy/pipeit
/plugin install pipeit@repleadfy`;

function Block({ label, code, recommended }: { label: string; code: string; recommended?: boolean }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-600 dark:text-gray-400">
          {label}
        </h2>
        {recommended && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
            recommended
          </span>
        )}
      </div>
      <div className="relative">
        <pre className="rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 pr-16 text-sm overflow-x-auto"><code>{code}</code></pre>
        <div className="absolute top-2 right-2">
          <CopyButton text={code} />
        </div>
      </div>
    </section>
  );
}

export function InstallPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">pipeit</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Share markdown from AI conversations. Read on any device.
          </p>
        </header>

        <Block label="Claude Code plugin" code={PLUGIN_COMMANDS} recommended />
        <Block label="npm" code="npx pipeit.live" />
        <Block label="Bun" code="bunx pipeit.live" />

        <p className="text-sm text-gray-600 dark:text-gray-400">
          After install: run <code className="text-gray-900 dark:text-gray-100">/pipeit</code> in Claude Code. Your browser opens once to sign in.
        </p>

        <p className="text-sm text-gray-500">
          Already installed? <Link to="/login" className="text-indigo-500 hover:text-indigo-400">Sign in →</Link>
        </p>
      </div>
    </div>
  );
}
