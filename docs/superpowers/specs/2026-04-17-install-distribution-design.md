# pipeit — Install & Distribution Design

Make pipeit installable via three channels — `npx pipeit`, `bunx pipeit`, and the Claude Code plugin marketplace (`/plugin marketplace add repleadfy/pipeit` + `/plugin install pipeit`) — with a clear separation between *install*, *auth*, and *share*.

## Scope

**In scope:**
- Claude Code as the only supported environment for this pass.
- Three install paths: CC plugin marketplace, `npx pipeit`, `bunx pipeit`.
- Shareable install page at `pipeit.live/install`.

**Out of scope (v1):**
- Cursor, VSCode, Codex, OpenCode — stay in the original design spec as future work.
- Invite links that pre-authenticate teammates.
- Server-side revocation UI for MCP tokens.
- Local credential files (`~/.pipeit/*`) — never exist. MCP client owns all tokens.
- `npx pipeit uninstall` — uninstall is `/plugin uninstall pipeit`.

## Guiding Principles

1. **One source of truth** — the plugin. Every install path ends in the same CC plugin state.
2. **Install ≠ auth.** Install writes config, does no network to pipeit.live, opens no browser. Auth happens on first `/pipeit` call via MCP OAuth.
3. **CC owns credentials.** No files under `~/.pipeit/`. CC manages access/refresh tokens.
4. **Ship one repo.** Plugin, CLI, server, web, skill all live in `repleadfy/pipeit`, versioned together.

## Repo Layout

```
repleadfy/pipeit/                     ← GitHub repo; also npm publisher and marketplace
├── .claude-plugin/
│   └── marketplace.json             ← what /plugin marketplace add reads
├── plugins/
│   └── pipeit/                       ← the Claude Code plugin
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── .mcp.json                ← MCP server pointer
│       └── skills/
│           └── pipeit/
│               └── SKILL.md         ← migrated from top-level skills/
├── packages/
│   ├── shared/                      ← existing
│   ├── mcp/                         ← existing
│   ├── server/                      ← existing
│   ├── web/                         ← existing; gains /install page
│   └── cli/                         ← NEW — publishes as `pipeit.live` on npm
├── skills/                          ← REMOVED (contents moved into plugins/pipeit/)
├── kdep/                            ← existing
└── docs/                            ← existing
```

The root `.claude-plugin/marketplace.json` is what `/plugin marketplace add repleadfy/pipeit` fetches and parses.

## Plugin & Marketplace Files

### `.claude-plugin/marketplace.json` (repo root)

```json
{
  "name": "repleadfy",
  "owner": { "name": "Leadfy", "url": "https://pipeit.live" },
  "plugins": [
    {
      "name": "pipeit",
      "source": "./plugins/pipeit",
      "description": "Share markdown from AI conversations to pipeit.live — read on any device.",
      "version": "0.1.0"
    }
  ]
}
```

### `plugins/pipeit/.claude-plugin/plugin.json`

```json
{
  "name": "pipeit",
  "version": "0.1.0",
  "description": "Pipe markdown from Claude Code to pipeit.live. Adds the /pipeit skill + MCP server connection.",
  "homepage": "https://pipeit.live",
  "repository": "https://github.com/repleadfy/pipeit",
  "license": "MIT"
}
```

### `plugins/pipeit/.mcp.json`

```json
{
  "mcpServers": {
    "pipeit": {
      "type": "http",
      "url": "https://pipeit.live/mcp"
    }
  }
}
```

CC loads this automatically when the plugin is enabled. It registers `pipeit` as an MCP server but does NOT authenticate — auth is triggered lazily on the first tool call.

### `plugins/pipeit/skills/pipeit/SKILL.md`

Moved verbatim from the existing `skills/pipeit/SKILL.md`. The file at the old top-level path is removed in the same commit.

## CLI — `pipeit.live` on npm

New monorepo package `packages/cli/`, published to npm as `pipeit.live`.

### `packages/cli/package.json`

```json
{
  "name": "pipeit",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "pipeit": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/node": "^22"
  }
}
```

The `bin` mapping means `npx pipeit` and `bunx pipeit` invoke the same binary.

### `packages/cli/src/index.ts`

```typescript
#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";

const MARKETPLACE = "repleadfy/pipeit";
const PLUGIN = "pipeit";

function hasClaudeCli(): boolean {
  const r = spawnSync("claude", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

function tryInstallViaCli(): boolean {
  try {
    execSync(`claude plugin marketplace add ${MARKETPLACE}`, { stdio: "inherit" });
    execSync(`claude plugin install ${PLUGIN}@${MARKETPLACE}`, { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

function printManualInstructions() {
  console.log();
  console.log("Run these two commands inside Claude Code:");
  console.log();
  console.log(`  /plugin marketplace add ${MARKETPLACE}`);
  console.log(`  /plugin install ${PLUGIN}`);
  console.log();
}

function printNextStep() {
  console.log("✓ pipeit ready");
  console.log();
  console.log("Next step:");
  console.log("  In Claude Code, run  /pipeit");
  console.log("  Your browser will open once to sign in (Google / GitHub / email).");
  console.log();
}

if (hasClaudeCli() && tryInstallViaCli()) {
  printNextStep();
} else {
  printManualInstructions();
  printNextStep();
}
```

### CLI behavior table

| Environment | Result |
|---|---|
| `claude` CLI in PATH and `plugin` subcommands exist | Shell out to `claude plugin marketplace add` + `claude plugin install` → print next step |
| `claude` CLI in PATH but `plugin` subcommand fails | Fall through to manual instructions + next step |
| No `claude` CLI (desktop-only CC, or non-CC editor) | Manual instructions + next step |

### Pre-merge validation

Before merging the CLI, verify that `claude plugin marketplace add <slug>` and `claude plugin install <name>@<slug>` exist as non-interactive subcommands in the current `claude` CLI. If the API shape differs, adjust the shell-out in `tryInstallViaCli()`. The fallback path is unaffected.

## `/install` Landing Page

Current state: `/` redirects authed users to `/d/latest` and unauthed users to `/login`. A teammate clicking a shared `pipeit.live` link lands on the sign-in form with zero context.

### Changes

**New route:** `/install` — public, no auth gate.

**New component:** `packages/web/src/pages/InstallPage.tsx`. Shows:

- One-line pitch: "Share markdown from AI conversations. Read on any device."
- Three copy-to-clipboard install blocks:
  1. **Claude Code plugin (recommended)** — two lines:
     ```
     /plugin marketplace add repleadfy/pipeit
     /plugin install pipeit
     ```
  2. **npm:** `npx pipeit`
  3. **Bun:** `bunx pipeit`
- Post-install hint: "After install: run `/pipeit` in Claude Code. Your browser opens once to sign in."
- Link: "Already installed? [Sign in →]" → `/login`.

Respects dark/light mode using the system already in place (commit `06c047e`).

### Routing changes in `App.tsx`

```tsx
<Route path="/install" element={<InstallPage />} />
<Route path="/" element={
  <ProtectedRoute fallback={<Navigate to="/install" replace />}>
    <Navigate to="/d/latest" replace />
  </ProtectedRoute>
} />
```

`ProtectedRoute` gains a `fallback` prop (currently hardcoded to `/login`). Unauthed `/` now goes to `/install`.

### Copy button

Small component: `navigator.clipboard.writeText()` + brief visual confirmation. ~20 lines, no new dependencies.

## Auth Flow — End-to-End

Two things need to be disentangled in the original spec:

1. **Install** — writes config only. No network call to pipeit.live. No browser opens.
2. **Auth** — happens on the FIRST `/pipeit` tool call, via MCP OAuth 2.0 dynamic client registration.

### Canonical sequence (plugin install path)

1. User: `/plugin marketplace add repleadfy/pipeit`
   - CC fetches `marketplace.json` from the repo. Shows plugin card. No pipeit.live traffic.
2. User: `/plugin install pipeit`
   - CC clones `plugins/pipeit/` from the repo.
   - Loads `plugin.json`, `SKILL.md`, `.mcp.json`.
   - Registers MCP server `pipeit` pointing at `https://pipeit.live/mcp`. No token acquired yet. No browser opens.
3. Post-install hint printed: "Next step: run `/pipeit`. Your browser will open once to sign in."
4. (Minutes, hours, or days later) User: `/pipeit ./spec.md`
   - Skill instructs Claude to call `pipeit_upload` MCP tool.
5. CC: `POST https://pipeit.live/mcp` → server returns `401 Unauthorized` + `WWW-Authenticate: Bearer` header with OAuth AS URL.
6. CC performs RFC 7591 dynamic client registration: `POST /mcp/register` → receives `{ client_id, client_secret }`. (Already implemented; commit `1acb97b`.)
7. CC opens user's browser to `https://pipeit.live/mcp/authorize?client_id=...&redirect_uri=http://localhost:XXXX/callback&...`
8. Two sub-cases:
   - **8a.** User already has a session cookie on pipeit.live → consent screen ("Allow Claude Code to upload docs?") → Allow → redirect to localhost with `?code=...`
   - **8b.** No session → `/login` page prompts for Google / GitHub / email/password → on success, redirect back to `/mcp/authorize` → consent → redirect with code.
9. CC: `POST /mcp/token` exchanges code for `{ access_token, refresh_token }`. CC stores tokens internally.
10. CC retries the original `pipeit_upload` call with `Authorization: Bearer <access_token>`. Server accepts, creates doc.
11. Claude prints: `✓ Piped to https://pipeit.live/d/<slug>`

### Path: `npx pipeit` / `bunx pipeit`

Identical to above from step 1 onward. The CLI either shells out to `claude plugin ...` (collapsing to the same plugin install) or prints instructions for the user to run them. Credentials never pass through the CLI.

### Key consequences

- **`LoginPage` serves two purposes:** direct web login AND login step during MCP OAuth. Same page, same flows. Documented explicitly so future readers don't wonder if there are two auth systems.
- **New React route: `/mcp/consent`** — required per OAuth 2.0 even when the user is already signed in. Lives in the SPA (`packages/web`), not server-rendered. Lists client metadata ("Claude Code" + issued timestamp) and has Allow / Deny buttons. Form POSTs to an existing server endpoint that completes the authorization and redirects to the OAuth `redirect_uri`. The backend already handles `/mcp/authorize`; the consent markup is the missing piece.
- **Post-install hint is the contract** — the frase "browser will open once to sign in" sets expectations for step 7 without requiring the user to understand OAuth.
- **Backend is ready.** Commits `1acb97b` (dynamic client registration) and `bacb458` (PUBLIC_URL for TLS-terminating proxy) wire up the server side. The remaining work is front-end (`/mcp/consent`, `/install` page) and packaging (plugin files, CLI, CI).

## Team Sharing

No new infra. The command string itself IS the share artifact.

- Slack-friendly one-liner: paste `pipeit.live` or the two `/plugin ...` commands.
- Teammates clicking `pipeit.live` land on `/install` (thanks to the routing change above), see the three copy-paste blocks, run them.
- Dropped: authenticated invite links. Out of scope v1 (significant server-side work for marginal UX gain).

## Updates & Uninstall

### Updates

- **Plugin**: bump `plugin.json.version` when skill or `.mcp.json` content changes. Users pull via `/plugin update pipeit`. App/server-only changes do NOT require a plugin bump because the plugin only points at the stable `https://pipeit.live/mcp` URL.
- **CLI** (`pipeit.live` on npm): `npx`/`bunx` always fetch the latest published version. No local state to update.
- **Server / skill / plugin**: all versioned together in the monorepo — impossible to drift.

### Uninstall

- **Plugin**: `/plugin uninstall pipeit` removes skill + MCP config from CC.
- **MCP tokens**: managed by CC. Revocation server-side is out of scope v1.
- **Account deletion**: `DELETE /api/account` — covered by `on delete cascade` in existing schema.

### Release / CI

A single `git tag vX.Y.Z` triggers:
1. GitHub release created — surfaces as latest version to `/plugin update`.
2. `yarn workspace pipeit publish` to npm.
3. Docker image build + push (existing kdep path).

All three version strings stay in lockstep: `plugin.json.version` = `packages/cli/package.json.version` = git tag.

## File-Level Change Summary

| Action | Path | Purpose |
|---|---|---|
| Add | `.claude-plugin/marketplace.json` | Marketplace manifest |
| Add | `plugins/pipeit/.claude-plugin/plugin.json` | Plugin manifest |
| Add | `plugins/pipeit/.mcp.json` | MCP server pointer |
| Move | `skills/pipeit/SKILL.md` → `plugins/pipeit/skills/pipeit/SKILL.md` | Relocate into plugin |
| Remove | `skills/` (top-level, after move) | No longer used |
| Add | `packages/cli/package.json` | New npm package |
| Add | `packages/cli/src/index.ts` | CLI logic |
| Add | `packages/cli/tsconfig.json` | TS config |
| Add | `packages/web/src/pages/InstallPage.tsx` | Public install page |
| Modify | `packages/web/src/App.tsx` | New route + fallback |
| Modify | `packages/web/src/components/ProtectedRoute.tsx` | `fallback` prop |
| Add | `packages/web/src/pages/ConsentPage.tsx` | OAuth consent screen (SPA route at `/mcp/consent`) |
| Modify | root `package.json` | Add `cli` to workspace build |
| Modify | CI config | Publish `pipeit.live` to npm on tag |

## Testing

- **CLI**: unit-test `hasClaudeCli()` and `tryInstallViaCli()` by stubbing `spawnSync`/`execSync`. Integration test: run `node dist/index.js` in a container without `claude` in PATH → assert manual instructions are printed.
- **Plugin**: smoke test by running `/plugin marketplace add <local-file-path>` against a local checkout and verifying plugin loads + skill appears.
- **Install page**: RTL test for copy-button behavior + route-fallback test that unauthed `/` goes to `/install`.
- **Consent page**: RTL test for Allow/Deny actions; integration test against a local MCP authorize flow.
- **End-to-end**: manual QA — `bunx pipeit` on a fresh machine, then `/pipeit` in CC, verify browser opens, sign in, doc uploads.

## Risks & Open Questions

1. **CC plugin CLI API shape.** Need to verify `claude plugin marketplace add` and `claude plugin install` exist as non-interactive subcommands before merge. If they don't, the shell-out branch is dead and everyone falls through to manual instructions (still fine, just less polish).
2. **`pipeit.live` on npm availability.** Need to check `npm view pipeit` before publishing. If taken, fall back to `@repleadfy/pipeit` (uglier but guaranteed).
3. **Consent page design.** No prior consent UI in the repo. Small scope but needs a mock — follows existing Tailwind/typography patterns.
4. **Marketplace.json schema.** Following the CC public plugin spec as of 2026-04. Schema could evolve; pin to the latest shape and verify with a `/plugin marketplace add` dry run before release.
