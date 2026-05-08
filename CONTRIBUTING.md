# Contributing to pipeit

Thanks for being here. pipeit is small enough that one good PR moves it noticeably forward.

## Project layout

```
packages/
  web/        # React 19 · Vite · Tailwind 4   — pipeit.live frontend
  server/     # Hono · Drizzle · Postgres       — API & auth
  mcp/        # MCP server                       — OAuth proxy for Claude Code
  cli/        # pipeit-upload + pipeit.live      — npm/bun installers + upload binary
  shared/     # types & utilities                — used across packages

plugins/pipeit/    # the Claude Code plugin (skill + bin + plugin.json)
docs/              # install, ops, this file
kdep/              # Kubernetes manifests for self-host / pipeit.live
drizzle/           # schema migrations
```

## Local setup

```bash
yarn install
cp packages/server/.env.example packages/server/.env  # fill in OAuth credentials
yarn workspace @pipeit/server run dev:db              # start postgres in docker
yarn dev:server                                       # api on :3001
yarn dev:web                                          # web on :5173
```

The web app proxies `/api/*` to the server in dev. Sign-in uses real OAuth — set up Google/GitHub clients pointing at `http://localhost:5173/auth/callback` for testing.

## Tests

Each workspace has its own:

```bash
yarn workspace @pipeit/server test
yarn workspace @pipeit/cli test     # node --test + tsx
yarn workspace web test
```

Run the full matrix before opening a PR.

## Commit style

Conventional commits, scoped to the area you touched:

```
feat(web): add reading-progress sidebar
fix(cli): handle expired token without prompting twice
docs(readme): tighten the why section
chore(deps): bump drizzle to 0.32
```

**Scopes in use:** `web`, `server`, `mcp`, `cli`, `shared`, `pipeit` (plugin), `docs`, `ci`, `chore`.

If a commit fixes an issue, link it: `fix(server): rate limit auth endpoint (closes #42)`.

## PR flow

1. Open an issue first for non-trivial work — saves both of us time if direction's off.
2. Branch from `main`, keep PRs small and focused (one concern per PR).
3. Fill in the PR template — it asks for the things that matter.
4. CI must be green. If it's flaking, say so in the PR; don't bypass.
5. Squash-merge is the default. Keep the squashed commit message clean.

## What we say yes / no to

**Yes**: bug fixes with a repro, performance improvements with numbers, viewer enhancements (new file formats, better rendering), accessibility fixes, docs, tests.

**Maybe**: new features. Open an issue first; we don't want you to spend a weekend on something we'd ask you to redesign.

**No**: changes that break the "no LLM tokenization" property of uploads, additions that require new third-party services without a self-host fallback, anything that adds telemetry without a clear opt-out.

## Releasing

Maintainers only:

```bash
# bump packages/cli/package.json + plugins/pipeit/.claude-plugin/plugin.json + .claude-plugin/marketplace.json
# update CHANGELOG.md
git tag v0.1.x && git push --tags
# CI publishes to npm automatically
```

The plugin, CLI, and marketplace pin must stay in lockstep — the release workflow enforces this.
