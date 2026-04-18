# Install & Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship mpipe as a Claude Code plugin installable via three channels (`/plugin marketplace add`, `npx mpipe.dev`, `bunx mpipe.dev`), with a public `/install` landing page and a React-based OAuth consent screen.

**Architecture:** Single monorepo (`repleadfy/mpipe`) hosts a root marketplace manifest, a `plugins/mpipe/` plugin package, a new `packages/cli/` bootstrap that shells out to the `claude` CLI when available, and two new SPA routes (`/install`, `/mcp/consent`). Install writes config only; OAuth happens lazily on the first MCP tool call.

**Tech Stack:** TypeScript, Node 22, Hono, React 19 + react-router 7, Tailwind 4, Vite 8, Vitest + React Testing Library (new for this feature), GitHub Actions for release automation.

---

## File Structure

**New files (create):**
- `.claude-plugin/marketplace.json` — root marketplace manifest
- `plugins/mpipe/.claude-plugin/plugin.json` — plugin manifest
- `plugins/mpipe/.mcp.json` — MCP server pointer
- `plugins/mpipe/skills/mpipe/SKILL.md` — relocated from `skills/mpipe/SKILL.md`
- `packages/cli/package.json` — new npm package (`mpipe.dev`)
- `packages/cli/tsconfig.json`
- `packages/cli/src/index.ts` — CLI entry
- `packages/cli/src/cli.ts` — testable helpers (`hasClaudeCli`, `tryInstallViaCli`, `printManualInstructions`, `printNextStep`)
- `packages/cli/src/cli.test.ts` — unit tests for helpers
- `packages/web/src/components/ProtectedRoute.tsx` — extracted from `App.tsx`, adds `fallback` prop
- `packages/web/src/components/CopyButton.tsx` — clipboard-copy helper
- `packages/web/src/pages/InstallPage.tsx` — public install page
- `packages/web/src/pages/ConsentPage.tsx` — OAuth consent screen (SPA route `/mcp/consent`)
- `packages/web/src/pages/InstallPage.test.tsx`
- `packages/web/src/pages/ConsentPage.test.tsx`
- `packages/web/src/components/CopyButton.test.tsx`
- `packages/web/vitest.config.ts` — Vitest + jsdom config
- `packages/web/src/test-setup.ts` — RTL globals
- `.github/workflows/release.yml` — tag-triggered GitHub release + npm publish + docker push
- `docs/install.md` — human-readable install reference linked from README

**Modified files:**
- `packages/web/src/App.tsx` — remove inline `ProtectedRoute`, import extracted one, add `/install` + `/mcp/consent` routes, change unauthed `/` fallback to `/install`
- `packages/web/package.json` — add vitest, @testing-library/react, @testing-library/jest-dom, jsdom
- `packages/web/src/pages/LoginPage.tsx` — honor `?return_to=` query param so MCP flow lands back on `/mcp/consent` after sign-in
- `packages/mcp/src/oauth.ts` — replace inline HTML login at `/authorize` with redirect to SPA (`/login?return_to=/mcp/consent` when unauthed, `/mcp/consent` when authed); add `GET /consent-info` + `POST /consent` endpoints
- `packages/server/src/auth/google.ts` — after MCP-flow login, redirect to SPA `/mcp/consent` (not `/mcp/callback`)
- `packages/server/src/auth/github.ts` — same
- `packages/server/src/auth/email.ts` — same (plus honor `mcp_oauth=1` query like google/github)
- `package.json` (root) — add `build:cli` script and include CLI in `build`
- `skills/mpipe/SKILL.md` — **delete** after content move (in same commit as create of new path)
- `README.md` — add install section pointing at `mpipe.dev` and the three install commands

---

## Task 1: Move SKILL.md into the plugin directory

**Files:**
- Create: `plugins/mpipe/.claude-plugin/plugin.json`
- Create: `plugins/mpipe/.mcp.json`
- Create: `plugins/mpipe/skills/mpipe/SKILL.md` (verbatim copy of `skills/mpipe/SKILL.md`)
- Delete: `skills/mpipe/SKILL.md`
- Delete: `skills/` directory (once empty)
- Create: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Read the current SKILL.md and snapshot its exact content**

Run: `cat skills/mpipe/SKILL.md`

(Keep the output in your head / scratch — the new file must be byte-identical except for path.)

- [ ] **Step 2: Create `plugins/mpipe/skills/mpipe/SKILL.md` with the exact same content**

Use the Write tool with the content captured in Step 1. The YAML frontmatter (`name: mpipe`, `description: ...`) and the Usage/Behavior body must be preserved verbatim.

- [ ] **Step 3: Create `plugins/mpipe/.claude-plugin/plugin.json`**

```json
{
  "name": "mpipe",
  "version": "0.1.0",
  "description": "Pipe markdown from Claude Code to mpipe.dev. Adds the /mpipe skill + MCP server connection.",
  "homepage": "https://mpipe.dev",
  "repository": "https://github.com/repleadfy/mpipe",
  "license": "MIT"
}
```

- [ ] **Step 4: Create `plugins/mpipe/.mcp.json`**

```json
{
  "mcpServers": {
    "mpipe": {
      "type": "http",
      "url": "https://mpipe.dev/mcp"
    }
  }
}
```

- [ ] **Step 5: Create `.claude-plugin/marketplace.json` at the repo root**

```json
{
  "name": "repleadfy",
  "owner": { "name": "Leadfy", "url": "https://mpipe.dev" },
  "plugins": [
    {
      "name": "mpipe",
      "source": "./plugins/mpipe",
      "description": "Share markdown from AI conversations to mpipe.dev — read on any device.",
      "version": "0.1.0"
    }
  ]
}
```

- [ ] **Step 6: Delete the old skill location**

```bash
rm skills/mpipe/SKILL.md
rmdir skills/mpipe skills
```

- [ ] **Step 7: Verify layout matches the spec**

```bash
ls -R .claude-plugin plugins
```

Expected:
```
.claude-plugin:
marketplace.json

plugins:
mpipe

plugins/mpipe:
.claude-plugin  .mcp.json  skills

plugins/mpipe/.claude-plugin:
plugin.json

plugins/mpipe/skills:
mpipe

plugins/mpipe/skills/mpipe:
SKILL.md
```

- [ ] **Step 8: Commit**

```bash
git add .claude-plugin plugins skills
git commit -m "feat: relocate SKILL.md into plugins/mpipe and add marketplace manifest"
```

---

## Task 2: Scaffold the CLI package

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts` (empty entry stub for now)

- [ ] **Step 1: Create `packages/cli/package.json`**

```json
{
  "name": "mpipe.dev",
  "version": "0.1.0",
  "type": "module",
  "description": "One-shot installer for the mpipe Claude Code plugin.",
  "bin": {
    "mpipe.dev": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "node --import tsx --test src/*.test.ts"
  },
  "devDependencies": {
    "@types/node": "^22.15.3",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create placeholder `packages/cli/src/index.ts`**

```typescript
#!/usr/bin/env node
// Entry populated in Task 3.
```

- [ ] **Step 4: Install workspace dependencies**

Run: `yarn install`
Expected: yarn picks up the new workspace, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/cli package.json yarn.lock
git commit -m "chore(cli): scaffold packages/cli workspace"
```

---

## Task 3: CLI helpers (testable, no side effects at import time)

**Files:**
- Create: `packages/cli/src/cli.ts`
- Create: `packages/cli/src/cli.test.ts`

- [ ] **Step 1: Write failing test for `hasClaudeCli` (claude absent)**

Write `packages/cli/src/cli.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasClaudeCli, tryInstallViaCli, printManualInstructions, printNextStep } from "./cli.js";

test("hasClaudeCli returns false when spawn status is non-zero", () => {
  const spawn = () => ({ status: 127 } as { status: number });
  assert.equal(hasClaudeCli(spawn), false);
});

test("hasClaudeCli returns true when spawn status is zero", () => {
  const spawn = () => ({ status: 0 } as { status: number });
  assert.equal(hasClaudeCli(spawn), true);
});

test("tryInstallViaCli returns true when both exec calls succeed", () => {
  const calls: string[] = [];
  const exec = (cmd: string) => { calls.push(cmd); };
  assert.equal(tryInstallViaCli(exec), true);
  assert.deepEqual(calls, [
    "claude plugin marketplace add repleadfy/mpipe",
    "claude plugin install mpipe@repleadfy/mpipe",
  ]);
});

test("tryInstallViaCli returns false if exec throws", () => {
  const exec = () => { throw new Error("not found"); };
  assert.equal(tryInstallViaCli(exec), false);
});

test("printManualInstructions writes the two /plugin lines", () => {
  const lines: string[] = [];
  printManualInstructions((s) => lines.push(s));
  assert.ok(lines.some((l) => l.includes("/plugin marketplace add repleadfy/mpipe")));
  assert.ok(lines.some((l) => l.includes("/plugin install mpipe")));
});

test("printNextStep mentions /mpipe and browser sign-in", () => {
  const lines: string[] = [];
  printNextStep((s) => lines.push(s));
  const joined = lines.join("\n");
  assert.match(joined, /\/mpipe/);
  assert.match(joined, /browser/i);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `yarn workspace mpipe.dev test`
Expected: FAIL — "Cannot find module './cli.js'" or the helpers don't exist.

- [ ] **Step 3: Write `packages/cli/src/cli.ts` with injected dependencies**

```typescript
import { execSync as realExec, spawnSync as realSpawn } from "node:child_process";

export const MARKETPLACE = "repleadfy/mpipe";
export const PLUGIN = "mpipe";

type SpawnFn = (cmd: string, args: string[]) => { status: number | null };
type ExecFn = (cmd: string) => void;
type LogFn = (line: string) => void;

export function hasClaudeCli(spawn: SpawnFn = (c, a) => realSpawn(c, a, { stdio: "ignore" })): boolean {
  const r = spawn("claude", ["--version"]);
  return r.status === 0;
}

export function tryInstallViaCli(exec: ExecFn = (c) => { realExec(c, { stdio: "inherit" }); }): boolean {
  try {
    exec(`claude plugin marketplace add ${MARKETPLACE}`);
    exec(`claude plugin install ${PLUGIN}@${MARKETPLACE}`);
    return true;
  } catch {
    return false;
  }
}

export function printManualInstructions(log: LogFn = console.log): void {
  log("");
  log("Run these two commands inside Claude Code:");
  log("");
  log(`  /plugin marketplace add ${MARKETPLACE}`);
  log(`  /plugin install ${PLUGIN}`);
  log("");
}

export function printNextStep(log: LogFn = console.log): void {
  log("✓ mpipe ready");
  log("");
  log("Next step:");
  log("  In Claude Code, run  /mpipe");
  log("  Your browser will open once to sign in (Google / GitHub / email).");
  log("");
}
```

- [ ] **Step 4: Re-run tests**

Run: `yarn workspace mpipe.dev test`
Expected: PASS — all six tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/cli.ts packages/cli/src/cli.test.ts
git commit -m "feat(cli): add install helpers with injected dependencies and unit tests"
```

---

## Task 4: CLI entry point wiring

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Replace the placeholder entry with the real wiring**

```typescript
#!/usr/bin/env node
import { hasClaudeCli, tryInstallViaCli, printManualInstructions, printNextStep } from "./cli.js";

if (hasClaudeCli() && tryInstallViaCli()) {
  printNextStep();
} else {
  printManualInstructions();
  printNextStep();
}
```

- [ ] **Step 2: Build the CLI**

Run: `yarn workspace mpipe.dev build`
Expected: produces `packages/cli/dist/index.js` with a leading `#!/usr/bin/env node` line.

- [ ] **Step 3: Smoke-test the manual path by forcing `claude` absent**

```bash
env PATH=/usr/bin:/bin node packages/cli/dist/index.js
```

Expected output contains both:
```
/plugin marketplace add repleadfy/mpipe
/plugin install mpipe
```
and:
```
Next step:
  In Claude Code, run  /mpipe
```

- [ ] **Step 4: Verify the dist entry is executable and shebang-first**

```bash
head -1 packages/cli/dist/index.js
```
Expected: `#!/usr/bin/env node`

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): wire entry point to install helpers"
```

---

## Task 5: Pre-merge verification of `claude` CLI subcommands

**Files:** none — documentation step with a recorded verdict.

- [ ] **Step 1: Check the installed claude CLI for `plugin` subcommands**

Run: `claude plugin --help 2>&1 | head -40`

If the help lists `marketplace add` and `install` as non-interactive subcommands: the shell-out path in `tryInstallViaCli` is correct — mark ✔.

If the shape differs (different verb names, required prompts, missing `plugin` group): record the actual shape and **edit `packages/cli/src/cli.ts`** so `tryInstallViaCli` shells out to the correct commands. Do NOT change the test structure; the tests pass regardless of the exact string because they use the exported constants and dependency injection — if the strings change, update the assertion in `cli.test.ts` to match.

- [ ] **Step 2: Record the verdict in the plan**

Append one of these lines at the bottom of this plan under a `## Verification notes` section:
- `Task 5 verdict (YYYY-MM-DD): claude plugin subcommands confirmed as "marketplace add" and "install" — no CLI changes needed.`
- `Task 5 verdict (YYYY-MM-DD): claude plugin subcommands differ — updated tryInstallViaCli to <new strings>.`

- [ ] **Step 3: If you made code changes, rerun the CLI tests**

Run: `yarn workspace mpipe.dev test`
Expected: PASS.

- [ ] **Step 4: Commit (only if code changed)**

```bash
git add packages/cli/src/cli.ts packages/cli/src/cli.test.ts docs/superpowers/plans/2026-04-17-install-distribution.md
git commit -m "chore(cli): adjust shell-out to match verified claude plugin CLI shape"
```

---

## Task 6: Set up test framework for the web package

**Files:**
- Modify: `packages/web/package.json`
- Create: `packages/web/vitest.config.ts`
- Create: `packages/web/src/test-setup.ts`

- [ ] **Step 1: Add Vitest, jsdom, and Testing Library dev-dependencies**

Run:
```bash
yarn workspace web add -D vitest@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 @types/jsdom@^21
```
Expected: `package.json` updated, yarn.lock updated.

- [ ] **Step 2: Add a `test` script to `packages/web/package.json`**

In the `scripts` block, add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `packages/web/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 4: Create `packages/web/src/test-setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Sanity-check the framework with a trivial inline test**

Create `packages/web/src/smoke.test.ts` with:
```typescript
import { test, expect } from "vitest";
test("smoke", () => { expect(1 + 1).toBe(2); });
```

Run: `yarn workspace web test`
Expected: PASS — 1 test.

- [ ] **Step 6: Delete the smoke test**

```bash
rm packages/web/src/smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add packages/web/package.json packages/web/vitest.config.ts packages/web/src/test-setup.ts yarn.lock
git commit -m "chore(web): add vitest + react-testing-library harness"
```

---

## Task 7: Extract `ProtectedRoute` with a `fallback` prop

**Files:**
- Create: `packages/web/src/components/ProtectedRoute.tsx`
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Create `packages/web/src/components/ProtectedRoute.tsx`**

```tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";

export function ProtectedRoute({
  children,
  fallback = <Navigate to="/login" replace />,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <>{fallback}</>;
  return <>{children}</>;
}
```

- [ ] **Step 2: Replace the inline component in `App.tsx`**

Full replacement content for `packages/web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DocPage } from "./pages/DocPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/d/:slug" element={<DocPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute fallback={<Navigate to="/install" replace />}>
                <Navigate to="/d/latest" replace />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

(The `/install` and `/mcp/consent` routes are added in Tasks 10 and 13. This step intentionally leaves `/install` unresolved so the fallback change is isolated to this commit; the user hitting `/` unauthed will land on the 404 page until Task 10 — acceptable during staged rollout.)

- [ ] **Step 3: Build to confirm no type errors**

Run: `yarn workspace web build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/ProtectedRoute.tsx packages/web/src/App.tsx
git commit -m "refactor(web): extract ProtectedRoute into its own component with fallback prop"
```

---

## Task 8: `CopyButton` component

**Files:**
- Create: `packages/web/src/components/CopyButton.tsx`
- Create: `packages/web/src/components/CopyButton.test.tsx`

- [ ] **Step 1: Write the failing test**

`packages/web/src/components/CopyButton.test.tsx`:

```tsx
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "./CopyButton.js";

describe("CopyButton", () => {
  test("writes the provided text to the clipboard on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton text="hello world" />);
    await userEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("hello world");
  });

  test("shows 'Copied' state briefly after a successful copy", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<CopyButton text="x" />);
    await userEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace web test`
Expected: FAIL — cannot resolve `./CopyButton.js`.

- [ ] **Step 3: Create `packages/web/src/components/CopyButton.tsx`**

```tsx
import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-700 transition"
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
```

- [ ] **Step 4: Re-run tests**

Run: `yarn workspace web test`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/CopyButton.tsx packages/web/src/components/CopyButton.test.tsx
git commit -m "feat(web): add CopyButton with clipboard write and 'Copied' feedback"
```

---

## Task 9: `InstallPage` component

**Files:**
- Create: `packages/web/src/pages/InstallPage.tsx`
- Create: `packages/web/src/pages/InstallPage.test.tsx`

- [ ] **Step 1: Write the failing test**

`packages/web/src/pages/InstallPage.test.tsx`:

```tsx
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InstallPage } from "./InstallPage.js";

describe("InstallPage", () => {
  test("renders all three install commands", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getByText(/plugin marketplace add repleadfy\/mpipe/)).toBeInTheDocument();
    expect(screen.getByText(/plugin install mpipe/)).toBeInTheDocument();
    expect(screen.getByText(/npx mpipe\.dev/)).toBeInTheDocument();
    expect(screen.getByText(/bunx mpipe\.dev/)).toBeInTheDocument();
  });

  test("shows the post-install hint mentioning /mpipe and browser sign-in", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getByText(/\/mpipe/)).toBeInTheDocument();
    expect(screen.getByText(/browser opens once to sign in/i)).toBeInTheDocument();
  });

  test("links to the login page for existing users", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link.getAttribute("href")).toBe("/login");
  });

  test("renders a copy button for each install block", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getAllByRole("button", { name: /copy/i })).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `yarn workspace web test`
Expected: FAIL — cannot resolve `./InstallPage.js`.

- [ ] **Step 3: Create `packages/web/src/pages/InstallPage.tsx`**

```tsx
import { Link } from "react-router-dom";
import { CopyButton } from "../components/CopyButton.js";

const PLUGIN_COMMANDS = `/plugin marketplace add repleadfy/mpipe
/plugin install mpipe`;

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
          <h1 className="text-3xl font-bold">mpipe</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Share markdown from AI conversations. Read on any device.
          </p>
        </header>

        <Block label="Claude Code plugin" code={PLUGIN_COMMANDS} recommended />
        <Block label="npm" code="npx mpipe.dev" />
        <Block label="Bun" code="bunx mpipe.dev" />

        <p className="text-sm text-gray-600 dark:text-gray-400">
          After install: run <code className="text-gray-900 dark:text-gray-100">/mpipe</code> in Claude Code. Your browser opens once to sign in.
        </p>

        <p className="text-sm text-gray-500">
          Already installed? <Link to="/login" className="text-indigo-500 hover:text-indigo-400">Sign in →</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run tests**

Run: `yarn workspace web test`
Expected: PASS — 4 tests in InstallPage plus the 2 in CopyButton.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/InstallPage.tsx packages/web/src/pages/InstallPage.test.tsx
git commit -m "feat(web): add public /install page with copy-to-clipboard command blocks"
```

---

## Task 10: Wire `/install` route and route-fallback test

**Files:**
- Modify: `packages/web/src/App.tsx`
- Create: `packages/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing routing test**

`packages/web/src/App.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { InstallPage } from "./pages/InstallPage.js";

function TestRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/install" element={<InstallPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute fallback={<Navigate to="/install" replace />}>
              <div>Authed home</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

describe("unauthed routing", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: null }),
    }) as unknown as typeof fetch;
  });

  test("unauthed visit to / renders the InstallPage", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <TestRoutes />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Share markdown from AI conversations/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `yarn workspace web test`
Expected: FAIL — either InstallPage not rendered (still on loading) or auth context resolves to `user !== null`. If the failure is a missing `fetch` mock call shape, inspect `src/lib/auth.ts` and adapt.

- [ ] **Step 3: Add the `/install` route to `App.tsx`**

Edit `packages/web/src/App.tsx` to include:
```tsx
import { InstallPage } from "./pages/InstallPage.js";
```
and inside `<Routes>`:
```tsx
<Route path="/install" element={<InstallPage />} />
```

Full `App.tsx` after this step:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DocPage } from "./pages/DocPage.js";
import { InstallPage } from "./pages/InstallPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/d/:slug" element={<DocPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute fallback={<Navigate to="/install" replace />}>
                <Navigate to="/d/latest" replace />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 4: Re-run tests**

Run: `yarn workspace web test`
Expected: PASS — routing test now green.

- [ ] **Step 5: Manual smoke**

Run: `yarn workspace web dev` (in a separate terminal) and visit `http://localhost:5173/install`. Confirm copy buttons work visually.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/App.test.tsx
git commit -m "feat(web): route unauthed / to /install"
```

---

## Task 11: Server endpoints for the consent flow

**Files:**
- Modify: `packages/mcp/src/oauth.ts`

- [ ] **Step 1: Replace the inline HTML at `GET /authorize` with a redirect to the SPA**

Open `packages/mcp/src/oauth.ts`. Find the `oauthApp.get("/authorize", ...)` handler. Replace **the entire handler body** (everything from the opening `(c) => {` to its matching `}` — the block that currently renders HTML via `c.html(html)`) with:

```typescript
oauthApp.get("/authorize", async (c) => {
  const clientId = c.req.query("client_id") ?? "";
  const redirectUri = c.req.query("redirect_uri") ?? "";
  const state = c.req.query("state") ?? "";
  const codeChallenge = c.req.query("code_challenge") ?? "";
  const codeChallengeMethod = c.req.query("code_challenge_method") ?? "S256";

  if (!redirectUri || !codeChallenge) {
    return c.json({ error: "missing redirect_uri or code_challenge" }, 400);
  }

  const oauthState = JSON.stringify({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod, issuedAt: Date.now() });
  setCookie(c, "mcp_oauth_state", oauthState, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  // Authed users go straight to the SPA consent page. Unauthed users detour to
  // /login?return_to=/mcp/consent — LoginPage will forward back after sign-in.
  const sessionToken = getCookie(c, "token");
  if (sessionToken) {
    return c.redirect("/mcp/consent");
  }
  return c.redirect("/login?return_to=/mcp/consent");
});
```

- [ ] **Step 2: Add `GET /consent-info` to the OAuth app**

After the `/authorize` handler, insert:

```typescript
// Returns the pending OAuth request metadata so the SPA can render the consent UI.
oauthApp.get("/consent-info", (c) => {
  const cookie = getCookie(c, "mcp_oauth_state");
  if (!cookie) return c.json({ error: "no pending authorization" }, 404);
  const { clientId, issuedAt } = JSON.parse(cookie) as { clientId: string; issuedAt: number };
  return c.json({
    client_id: clientId,
    client_name: "Claude Code",
    issued_at: issuedAt,
  });
});
```

- [ ] **Step 3: Add `POST /consent` — the approve/deny receiver**

After the `/consent-info` handler, insert:

```typescript
// The SPA consent page POSTs { action: "allow" | "deny" } with the session cookie.
// On allow: mint a code, delete the oauth_state cookie, redirect to redirect_uri with ?code=.
// On deny: delete the cookie and redirect with ?error=access_denied.
oauthApp.post("/consent", async (c) => {
  const body = await c.req.json<{ action?: string }>();
  const action = body?.action;
  const oauthStateCookie = getCookie(c, "mcp_oauth_state");
  if (!oauthStateCookie) return c.json({ error: "no pending authorization" }, 400);

  const { redirectUri, state, codeChallenge } = JSON.parse(oauthStateCookie);

  if (action === "deny") {
    setCookie(c, "mcp_oauth_state", "", { maxAge: 0, path: "/" });
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    return c.json({ redirect: url.toString() });
  }

  if (action !== "allow") {
    return c.json({ error: "invalid action" }, 400);
  }

  // Need a signed-in user to approve
  const sessionToken = getCookie(c, "token");
  if (!sessionToken) return c.json({ error: "not authenticated" }, 401);

  const { verifyJwt } = await import("../../server/src/auth/jwt.js"); // NOTE: adjust relative import per workspace layout
  const payload = await verifyJwt(sessionToken);
  const userId = payload.sub;

  const code = nanoid(32);
  authCodes.set(code, {
    userId,
    redirectUri,
    codeChallenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  setCookie(c, "mcp_oauth_state", "", { maxAge: 0, path: "/" });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return c.json({ redirect: url.toString() });
});
```

NOTE — the `verifyJwt` import path: `@mpipe/mcp` is a separate workspace; do NOT reach into `packages/server/src`. Instead, lift `verifyJwt` into `@mpipe/shared`. If it isn't already there, do:
1. Move/copy `packages/server/src/auth/jwt.ts` into `packages/shared/src/jwt.ts` exporting `verifyJwt`.
2. Update `packages/server/src/auth/jwt.ts` (and its importers) to re-export from `@mpipe/shared/jwt`.
3. In `packages/mcp/src/oauth.ts`, use: `import { verifyJwt } from "@mpipe/shared/jwt";` at the top of the file.

If `verifyJwt` is already shared, just use it. Delete the inline `await import` and put the import at the top of the file.

- [ ] **Step 4: Keep the legacy `/callback` endpoint for backward compatibility**

Do NOT delete `oauthApp.get("/callback", ...)` in this PR — it's still the redirect target used by `google.ts` and `github.ts` during the gap before Task 13 lands. Task 13 replaces those redirects.

- [ ] **Step 5: Build to confirm no type errors**

Run: `yarn workspace @mpipe/mcp build && yarn workspace @mpipe/server build`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/oauth.ts packages/shared packages/server/src/auth/jwt.ts
git commit -m "feat(mcp): add /consent-info and /consent endpoints for SPA-driven OAuth approval"
```

---

## Task 12: `ConsentPage` component

**Files:**
- Create: `packages/web/src/pages/ConsentPage.tsx`
- Create: `packages/web/src/pages/ConsentPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

`packages/web/src/pages/ConsentPage.test.tsx`:

```tsx
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ConsentPage } from "./ConsentPage.js";

const originalLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { assign: vi.fn(), href: "" },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { writable: true, value: originalLocation });
  vi.restoreAllMocks();
});

function mockFetchSequence(responses: Array<Partial<Response>>) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r as Response);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("ConsentPage", () => {
  test("shows client name from /consent-info", async () => {
    mockFetchSequence([{ ok: true, json: async () => ({ client_name: "Claude Code", issued_at: 1700000000000 }) }]);
    render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Claude Code/)).toBeInTheDocument());
  });

  test("Allow POSTs action=allow and navigates to returned redirect URL", async () => {
    const fetchMock = mockFetchSequence([
      { ok: true, json: async () => ({ client_name: "Claude Code", issued_at: 1 }) },
      { ok: true, json: async () => ({ redirect: "http://localhost:12345/callback?code=abc" }) },
    ]);
    render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    await screen.findByText(/Claude Code/);
    await userEvent.click(screen.getByRole("button", { name: /allow/i }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => c[0] === "/mcp/consent");
      expect(call?.[1]?.body).toContain('"allow"');
    });
    await waitFor(() => expect(window.location.href).toBe("http://localhost:12345/callback?code=abc"));
  });

  test("Deny POSTs action=deny", async () => {
    const fetchMock = mockFetchSequence([
      { ok: true, json: async () => ({ client_name: "Claude Code", issued_at: 1 }) },
      { ok: true, json: async () => ({ redirect: "http://localhost:12345/callback?error=access_denied" }) },
    ]);
    render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    await screen.findByText(/Claude Code/);
    await userEvent.click(screen.getByRole("button", { name: /deny/i }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => c[0] === "/mcp/consent");
      expect(call?.[1]?.body).toContain('"deny"');
    });
  });

  test("missing pending auth shows an error message", async () => {
    mockFetchSequence([{ ok: false, status: 404, json: async () => ({ error: "no pending authorization" }) }]);
    render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/no pending authorization/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace web test`
Expected: FAIL — cannot resolve `./ConsentPage.js`.

- [ ] **Step 3: Create `packages/web/src/pages/ConsentPage.tsx`**

```tsx
import { useEffect, useState } from "react";

type ConsentInfo = { client_name: string; issued_at: number };

export function ConsentPage() {
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/mcp/consent-info", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          setError(data.error || "unable to load authorization request");
          return;
        }
        setInfo(await r.json());
      })
      .catch(() => setError("network error"));
  }, []);

  async function decide(action: "allow" | "deny") {
    setSubmitting(true);
    const res = await fetch("/mcp/consent", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.redirect) {
      window.location.href = data.redirect;
      return;
    }
    setSubmitting(false);
    setError(data.error || "something went wrong");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-md space-y-6 p-8 rounded-xl border border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold">Authorize access</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && (
          <>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">{info.client_name}</span> is requesting
              permission to upload markdown to your mpipe account.
            </p>
            <p className="text-xs text-gray-500">
              Request issued {new Date(info.issued_at).toLocaleString()}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => decide("allow")}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                Allow
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => decide("deny")}
                className="flex-1 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-800 font-medium hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run tests**

Run: `yarn workspace web test`
Expected: PASS — all four ConsentPage tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/ConsentPage.tsx packages/web/src/pages/ConsentPage.test.tsx
git commit -m "feat(web): add /mcp/consent SPA page for OAuth approval"
```

---

## Task 13: Re-route auth callbacks through consent

**Files:**
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/pages/LoginPage.tsx`
- Modify: `packages/server/src/auth/google.ts`
- Modify: `packages/server/src/auth/github.ts`
- Modify: `packages/server/src/auth/email.ts`

- [ ] **Step 1: Add the `/mcp/consent` route to `App.tsx`**

Add inside `<Routes>`, before the catch-all:
```tsx
<Route path="/mcp/consent" element={<ConsentPage />} />
```
and import at the top:
```tsx
import { ConsentPage } from "./pages/ConsentPage.js";
```

- [ ] **Step 2: Teach `LoginPage` to honor `?return_to=`**

In `packages/web/src/pages/LoginPage.tsx`:

Add at the top:
```tsx
import { useSearchParams } from "react-router-dom";
```

Inside `LoginPage`, after `const [error, setError] = useState("");`:
```tsx
const [searchParams] = useSearchParams();
const returnTo = searchParams.get("return_to") || "/";
```

Replace the existing `<Navigate to="/" replace />` (the `if (user) return ...` line) with:
```tsx
if (user) return <Navigate to={returnTo} replace />;
```

Replace the `window.location.href = "/"` inside the form submit handler with:
```tsx
window.location.href = returnTo;
```

Update the two `<a>` tags for Google/GitHub to preserve `return_to`:
```tsx
<a href={`/auth/google${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`} ...>
<a href={`/auth/github${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`} ...>
```

- [ ] **Step 3: Update `packages/server/src/auth/google.ts`**

Find the block (near line 82–90):
```typescript
const mcpOauthState = getCookie(c, "mcp_oauth_state");
if (mcpOauthState) {
  return c.redirect(`${env.PUBLIC_URL}/mcp/callback?user_id=${userId}`);
}
return c.redirect(env.WEB_URL);
```

Replace with:
```typescript
const mcpOauthState = getCookie(c, "mcp_oauth_state");
if (mcpOauthState) {
  return c.redirect(`${env.PUBLIC_URL}/mcp/consent`);
}
const returnTo = c.req.query("return_to");
const target = returnTo && returnTo.startsWith("/") ? `${env.WEB_URL}${returnTo}` : env.WEB_URL;
return c.redirect(target);
```

Additionally, locate where the Google OAuth URL is built and preserve `return_to` round-trip (search for `state=` or a call that constructs `redirect_uri`). Append the user's `return_to` query param to the `state` string passed to Google, and parse it back here. If that's non-trivial, keep it simple: stash `return_to` in a short-lived cookie on the `GET /auth/google` entry, read it here.

- [ ] **Step 4: Update `packages/server/src/auth/github.ts`**

Same two changes as google.ts (swap `/mcp/callback` for `/mcp/consent`; add `return_to` handling for direct web login).

- [ ] **Step 5: Update `packages/server/src/auth/email.ts`**

If the email signup/login handler doesn't already check for `mcp_oauth_state`, add the same branch: after successful login, if cookie present → redirect to `/mcp/consent`; else respect any `return_to` from the request body.

Read the current file first:
```bash
cat packages/server/src/auth/email.ts
```

Find the success path (where it sets the JWT cookie and responds). Add before the success response:
```typescript
const mcpOauthState = getCookie(c, "mcp_oauth_state");
if (mcpOauthState) {
  return c.json({ redirect: "/mcp/consent" });
}
```

Update the LoginPage fetch handler (Step 2 above) to honor `data.redirect` if present — already covered by setting `window.location.href = returnTo` when `return_to` was passed in the URL, but make the email flow set `return_to=/mcp/consent` client-side before submit if present in URL. The simplest path: in `LoginPage`'s submit handler, after `if (res.ok)`, parse response JSON and prefer `data.redirect` over `returnTo`:
```tsx
if (res.ok) {
  const data = await res.json().catch(() => ({}));
  window.location.href = data.redirect || returnTo;
}
```

- [ ] **Step 6: Deprecate `/mcp/callback` — remove the now-unused GET handler**

In `packages/mcp/src/oauth.ts`, remove the `oauthApp.get("/callback", ...)` handler (~25 lines). It was only called from the auth redirects we just changed.

- [ ] **Step 7: Build and test**

```bash
yarn workspace @mpipe/mcp build
yarn workspace @mpipe/server build
yarn workspace @mpipe/server test
yarn workspace web test
yarn workspace web build
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/pages/LoginPage.tsx \
        packages/server/src/auth/google.ts packages/server/src/auth/github.ts \
        packages/server/src/auth/email.ts packages/mcp/src/oauth.ts
git commit -m "feat(auth): route MCP OAuth through SPA consent page, remove inline /mcp/callback"
```

---

## Task 14: Root workspace wiring for the CLI

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add `build:cli` and include it in `build`**

In root `package.json`, update `scripts`:
```json
  "scripts": {
    "dev:server": "yarn workspace @mpipe/server run dev",
    "dev:web": "yarn workspace web run dev",
    "build": "yarn workspace @mpipe/shared run build && yarn workspace @mpipe/mcp run build && yarn workspace @mpipe/server run build && yarn workspace web run build && yarn workspace mpipe.dev run build",
    "build:server": "yarn workspace @mpipe/shared run build && yarn workspace @mpipe/server run build",
    "build:cli": "yarn workspace mpipe.dev run build"
  }
```

- [ ] **Step 2: Run full build from root**

Run: `yarn build`
Expected: all five workspaces build successfully, `packages/cli/dist/index.js` is produced.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: include mpipe.dev CLI in root build pipeline"
```

---

## Task 15: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow file**

`.github/workflows/release.yml`:

```yaml
name: release

on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  contents: write  # create release
  packages: write  # for docker/ghcr if used

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - name: Verify version lockstep
        run: |
          TAG="${GITHUB_REF_NAME#v}"
          PKG=$(node -p "require('./packages/cli/package.json').version")
          PLUGIN=$(node -p "require('./plugins/mpipe/.claude-plugin/plugin.json').version")
          MKT=$(node -p "require('./.claude-plugin/marketplace.json').plugins[0].version")
          echo "tag=$TAG cli=$PKG plugin=$PLUGIN marketplace=$MKT"
          if [ "$TAG" != "$PKG" ] || [ "$TAG" != "$PLUGIN" ] || [ "$TAG" != "$MKT" ]; then
            echo "version mismatch"
            exit 1
          fi

      - run: yarn install --frozen-lockfile
      - run: yarn build

      - name: Publish CLI to npm
        run: yarn workspace mpipe.dev publish --new-version ${GITHUB_REF_NAME#v} --no-git-tag-version --non-interactive
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

- [ ] **Step 2: Record the required secret**

Append to `docs/install.md` (created in Task 17) the operator note: "CI requires the repository secret `NPM_TOKEN` — an npm access token with publish rights to `mpipe.dev`."

- [ ] **Step 3: Validate YAML syntax locally**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/release.yml','utf8')); console.log('ok')"`

(If `js-yaml` isn't available locally, alternative: `npx --yes yaml-lint .github/workflows/release.yml`.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add tag-triggered release workflow for mpipe.dev npm publish"
```

---

## Task 16: Pre-release publishability check

**Files:** none — verification with a documented verdict.

- [ ] **Step 1: Verify the npm name is available**

Run: `npm view mpipe.dev 2>&1`

- If output contains `404` or `Not Found` → name is available; proceed.
- If output shows a package already exists → fall back to `@repleadfy/mpipe`:
  1. Edit `packages/cli/package.json` → change `name` to `@repleadfy/mpipe` and add `"publishConfig": { "access": "public" }`.
  2. Edit `packages/cli/src/cli.ts` → nothing changes (MARKETPLACE/PLUGIN constants are unaffected).
  3. Edit `packages/web/src/pages/InstallPage.tsx` → change the npm/Bun blocks to `npx @repleadfy/mpipe` and `bunx @repleadfy/mpipe`, update the test file accordingly.
  4. Edit `.github/workflows/release.yml` → change the workspace name to `@repleadfy/mpipe`.

- [ ] **Step 2: Record the verdict**

Append to the `## Verification notes` section at the end of this plan:
- `Task 16 verdict (YYYY-MM-DD): mpipe.dev available — no changes.`
 OR
- `Task 16 verdict (YYYY-MM-DD): mpipe.dev unavailable — switched to @repleadfy/mpipe in <files>.`

- [ ] **Step 3: If changes were made, rerun tests and commit**

```bash
yarn workspace web test
yarn workspace mpipe.dev test
yarn workspace mpipe.dev build
git add packages/cli packages/web/src/pages/InstallPage.tsx packages/web/src/pages/InstallPage.test.tsx .github/workflows/release.yml
git commit -m "chore: fall back to @repleadfy/mpipe for CLI npm package"
```

---

## Task 17: README & install docs

**Files:**
- Modify: `README.md`
- Create: `docs/install.md`

- [ ] **Step 1: Create `docs/install.md`**

```markdown
# Installing mpipe

Three paths, same end state: the mpipe Claude Code plugin is registered with its MCP server pointer.

## 1. Claude Code plugin (recommended)

Inside Claude Code:

    /plugin marketplace add repleadfy/mpipe
    /plugin install mpipe

## 2. npm

    npx mpipe.dev

## 3. Bun

    bunx mpipe.dev

Both `npx` and `bunx` variants either shell out to the `claude` CLI (if present) or print the two `/plugin` lines for you to paste.

## After install

Run `/mpipe` inside Claude Code. Your browser opens once, you sign in (Google / GitHub / email), and the plugin's MCP server receives an access token managed by Claude Code. No credentials are stored on disk outside Claude Code.

## Updates

- Plugin: `/plugin update mpipe`
- CLI: `npx`/`bunx` always fetch the latest published version — no local state.
- Server: transparent — the plugin points at the stable `https://mpipe.dev/mcp` URL.

## Uninstall

- Plugin: `/plugin uninstall mpipe`
- Account deletion: `DELETE /api/account`

## Operator notes

- CI requires repository secret `NPM_TOKEN` (publish rights for `mpipe.dev`).
- Plugin, CLI, and marketplace versions must stay in lockstep (enforced by the release workflow).
```

- [ ] **Step 2: Add an Install section to `README.md`**

Read the current README first: `cat README.md | head -40`

Near the top (after the title/tagline), insert:
```markdown
## Install

The fastest path is the Claude Code plugin:

    /plugin marketplace add repleadfy/mpipe
    /plugin install mpipe

Or from a terminal:

    npx mpipe.dev   # or: bunx mpipe.dev

Full install reference: [docs/install.md](docs/install.md).
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/install.md
git commit -m "docs: add install instructions for plugin, npx, and bunx paths"
```

---

## Task 18: End-to-end manual QA checklist

**Files:** none — executed manually on a staging or local deployment.

- [ ] **Step 1: Fresh install via `bunx` with no `claude` CLI**

In a clean shell with `claude` not on PATH:
```bash
bunx mpipe.dev
```
Expected: prints the two `/plugin ...` lines, then the next-step hint.

- [ ] **Step 2: Fresh install via `npx` with `claude` CLI present**

```bash
npx mpipe.dev
```
Expected: runs `claude plugin marketplace add repleadfy/mpipe` and `claude plugin install mpipe@repleadfy/mpipe`, prints the next-step hint.

- [ ] **Step 3: Plugin install via CC**

Inside Claude Code:
```
/plugin marketplace add repleadfy/mpipe
/plugin install mpipe
```
Expected: plugin card appears; `/mpipe` appears in the skills list; MCP server `mpipe` appears in the MCP servers list but `401` / unauthenticated status.

- [ ] **Step 4: First `/mpipe` call triggers browser OAuth**

Run `/mpipe ./README.md` in CC.
Expected: browser opens, lands on `/login?return_to=/mcp/consent` (unauthed) or `/mcp/consent` (authed). After approving, CC retries the tool call and prints `✓ Piped to https://mpipe.dev/d/<slug>`.

- [ ] **Step 5: Deny path**

Trigger another `/mpipe` from a CC instance that hasn't authorized yet. On `/mcp/consent`, click **Deny**.
Expected: browser redirects to CC's localhost callback with `?error=access_denied`. CC surfaces an auth error to the user.

- [ ] **Step 6: Shared `mpipe.dev` link for a teammate**

In a fresh browser profile (no session cookie), visit `https://mpipe.dev`.
Expected: lands on `/install`. Copy-buttons work. Clicking "Sign in →" goes to `/login`.

- [ ] **Step 7: Record QA results**

Append to the `## Verification notes` section of this plan the date and a ✔/✖ for each of Steps 1–6. Anything marked ✖ blocks release.

- [ ] **Step 8: Commit the verification notes**

```bash
git add docs/superpowers/plans/2026-04-17-install-distribution.md
git commit -m "docs: record pre-release manual QA results"
```

---

## Verification notes

- **Task 5 verdict (2026-04-17):** `claude plugin` subcommands confirmed as `marketplace add <source>` and `install <plugin>` (supporting the `plugin@marketplace` form). Current `tryInstallViaCli` strings (`claude plugin marketplace add repleadfy/mpipe`, `claude plugin install mpipe@repleadfy/mpipe`) match the live CLI shape — no code changes needed.

---

## Testing summary

| Layer | Framework | Coverage |
|---|---|---|
| CLI helpers | `node --test` + tsx | `hasClaudeCli`, `tryInstallViaCli`, `printManualInstructions`, `printNextStep` |
| Web components | Vitest + RTL + jsdom | `CopyButton`, `InstallPage`, `ConsentPage`, `App` routing fallback |
| Server OAuth | existing `@mpipe/server` tests | (no new server tests required — consent logic is thin and covered by E2E manual QA) |
| End-to-end | manual | Task 18 checklist — both install entry points + browser OAuth + deny path + shared link |

---

## Risk register (from spec §Risks)

1. **`claude plugin` subcommand shape** — resolved by Task 5 verification step; fallback is the manual-instructions path (still fully functional).
2. **`mpipe.dev` npm name availability** — resolved by Task 16; fallback is `@repleadfy/mpipe`.
3. **Consent page design** — Tailwind + existing typography patterns used; reviewed visually during Task 18 Step 6.
4. **Marketplace.json schema drift** — verified during Task 18 Step 3 (plugin card appears).
