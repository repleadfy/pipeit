# pipeit — Design Spec

Share markdown documents from AI conversations (Claude Code, Cursor, VSCode, Codex, OpenCode) and read them on any device with a polished PWA reader.

## System Overview

pipeit is three things:

1. **CLI skills** — `/pipeit` command that uploads markdown and returns a link
2. **API server** — receives, stores, and serves markdown documents
3. **Web reader PWA** — responsive markdown viewer with reading-position memory and push notifications

### Architecture

```
packages/
  shared/     ← Drizzle schema, types, utils
  server/     ← Hono API + MCP OAuth + auth + push notifications
  web/        ← React PWA (Vite + Tailwind) — markdown reader

npx pipeit   ← standalone npm CLI package for onboarding
skills/       ← /pipeit skill for CC, Cursor, VSCode, Codex, OpenCode
kdep/         ← K8s deployment config
```

Yarn workspaces monorepo. Same structure as `nemo_meet`.

### Request Flow

```
User in CC/Cursor/Claude.ai/etc.
  │
  │ /pipeit ./spec.md
  │
  ▼
Skill reads file ──► MCP tool call (pipeit_upload)
                        │
                        ▼ (MCP OAuth token)
                  Hono API (server/)
                  ├── stores doc in Postgres
                  ├── sends push notification if doc updated
                  └── returns { url, slug }
                        │
                        ▼
                  User/team opens URL
                        │
                        ▼
                  React PWA (web/)
                  ├── fetches doc via GET /api/docs/:slug
                  ├── renders with react-markdown + plugins
                  ├── tracks reading position (server-synced)
                  └── subscribes to push notifications
```

## Hosting & Infrastructure

- **Hosted SaaS** — single hosted instance (pipeit.live)
- **Kubernetes** — deployed to Leadfy AKS cluster, `pipeit` namespace
- **Deploy tool** — kdep (same as nemo_meet)
- **Database** — PostgreSQL 17, own instance in the `pipeit` namespace
- **Container** — single Docker image: Hono serves both API routes (`/api/*`, `/auth/*`, `/mcp/*`) and static PWA assets (`/*`)

## Authentication

Three auth methods for web login, one for AI tool access:

### Web Login

| Method | Flow |
|--------|------|
| **Google OAuth** | Redirect → Google → callback → session |
| **GitHub OAuth** | Redirect → GitHub → callback → session |
| **Email/password** | Sign up (email + password, no verification), login, forgot/reset password |

### AI Tool Access (MCP OAuth)

All AI tools (Claude Code, Cursor, VSCode, Claude.ai, ChatGPT) connect via MCP with OAuth:

- MCP server exposes tools: `pipeit_upload`, `pipeit_list`, `pipeit_delete`, `pipeit_toggle`
- First MCP tool call triggers OAuth flow → browser opens → user signs in (Google/GitHub/email) → token issued
- No local credential files (`~/.pipeit` etc.) — MCP handles token storage and refresh

### Onboarding (`npx pipeit`)

```bash
npx pipeit
```

1. Detects environment (Claude Code, Cursor, VSCode, Codex, OpenCode)
2. Adds MCP server config to the appropriate config file (`.mcp.json`, VS Code settings, etc.)
3. Installs the `/pipeit` skill
4. Prints instructions: "Run /pipeit to share your first doc. Browser will open once for sign-in."

Account creation happens on first auth, not during `npx`. Zero friction — no forms during onboarding.

## Data Model

PostgreSQL with Drizzle ORM. Schema in `packages/shared/src/db/schema.ts`.

### Tables

```
users
  id              uuid PK default gen_random_uuid()
  name            text not null
  email           text unique not null
  avatar_url      text
  created_at      timestamp default now()
  last_seen_at    timestamp default now()

auth_identities
  id              uuid PK default gen_random_uuid()
  user_id         uuid FK → users (on delete cascade)
  provider        enum('google', 'github', 'email')
  provider_id     text not null       -- OAuth: provider user ID; email: bcrypt hash
  email           text                -- for email/pass login + reset
  created_at      timestamp default now()
  unique(provider, provider_id)

docs
  id              uuid PK default gen_random_uuid()
  user_id         uuid FK → users (on delete cascade)
  slug            text unique not null   -- nanoid, used in URLs
  file_path       text                   -- original path, for update-in-place matching
  title           text not null          -- extracted from first # heading or filename
  content         text not null          -- raw markdown
  version         integer default 1      -- increments on update-in-place
  is_public       boolean default false  -- true = anyone with link can view
  created_at      timestamp default now()
  updated_at      timestamp default now()
  index(user_id, file_path)              -- for update-in-place lookups

reading_positions
  id              uuid PK default gen_random_uuid()
  user_id         uuid FK → users (on delete cascade)
  doc_id          uuid FK → docs (on delete cascade)
  scroll_pct      float not null         -- 0.0 to 1.0
  heading_id      text                   -- nearest heading anchor ID
  updated_at      timestamp default now()
  unique(user_id, doc_id)

push_subscriptions
  id              uuid PK default gen_random_uuid()
  user_id         uuid FK → users (on delete cascade)
  endpoint        text not null
  p256dh          text not null
  auth            text not null
  created_at      timestamp default now()
  unique(user_id, endpoint)
```

### Key Design Decisions

- **`file_path` on docs** enables update-in-place: same `user_id` + same `file_path` = update existing doc (increment version, replace content)
- **`slug`** is a short nanoid for URLs (e.g., `a8f3k2x9`), unguessable
- **`is_public`** toggles between private (only owner via auth) and shareable (anyone with link)
- **`reading_positions`** stores per-user per-doc position using both scroll percentage and heading anchor (heading is more resilient across doc version changes)
- **`version`** enables "doc updated" push notifications
- **Documents live forever** — no auto-expiry, no garbage collection

## API Routes

### Auth

```
GET  /auth/google              → redirect to Google OAuth
GET  /auth/google/callback     → handle callback, create/find user, set session cookie
GET  /auth/github              → redirect to GitHub OAuth
GET  /auth/github/callback     → handle callback, create/find user, set session cookie
POST /auth/email/signup        → { email, password, name } → create user + session
POST /auth/email/login         → { email, password } → session
POST /auth/email/reset         → { email } → send reset link
POST /auth/email/reset/:token  → { password } → set new password
POST /auth/logout              → clear session
GET  /auth/me                  → current user info
```

### MCP OAuth

```
GET  /mcp/authorize            → MCP OAuth authorization endpoint
POST /mcp/token                → MCP OAuth token exchange
```

### Docs

```
POST   /api/docs               → upload markdown { content, file_path?, is_public? } → { slug, url, is_new }
PUT    /api/docs/:slug         → update doc content { content } → { slug, url, version }
GET    /api/docs/:slug         → get doc (auth required if private, public if is_public)
DELETE /api/docs/:slug         → delete doc
GET    /api/docs               → list user's docs (supports ?q=search&read_state=reading&visibility=public)
PATCH  /api/docs/:slug         → update metadata { is_public?, title? }
```

Upload logic (`POST /api/docs`): if `file_path` is provided and a doc exists with the same `user_id` + `file_path`, update in place (increment version, replace content). Otherwise create new doc with fresh slug. `--new` flag from skill omits `file_path` to force a new doc. `PUT /api/docs/:slug` is for direct updates when the caller already knows the slug (e.g., from the web UI).

### Reading Position

```
PUT  /api/docs/:slug/position  → save { scroll_pct, heading_id }
GET  /api/docs/:slug/position  → get saved position for current user
```

### Push Notifications

```
POST   /api/push/subscribe     → save push subscription { endpoint, p256dh, auth }
DELETE /api/push/subscribe     → remove subscription
```

### Rate Limiting

- Doc uploads: 60/hour per user
- Auth endpoints: 10/min for login, 3/min for signup
- API reads: 300/min per user
- Public doc reads: 120/min per IP

## MCP Server Tools

Exposed via the MCP protocol for AI tool access:

```
pipeit_upload   → { content, file_path?, is_public? } → { url, slug, is_new }
pipeit_list     → { q?, read_state?, visibility? } → [{ slug, title, version, updated_at, is_public }]
pipeit_delete   → { slug } → { ok }
pipeit_toggle   → { slug, is_public } → { url }
```

## Skill (`/pipeit`)

### Usage

```
/pipeit                        → share last markdown block from conversation
/pipeit ./path/to/file.md      → share a specific file
/pipeit --new ./file.md        → force new link (snapshot, no update-in-place)
/pipeit --public ./file.md     → create/update with public shareable link
```

### Behavior

1. Read file content (or extract markdown from conversation context)
2. Call MCP tool `pipeit_upload` with `{ content, file_path, is_public }`
3. Receive `{ url, slug, is_new }`
4. Print the URL to the user
5. If Slack MCP is detected (tools matching `slack_send_message` exist), suggest: "Want to share this on Slack? Which channel?"

### Multi-Editor Support

The skill and MCP server config must work across:

- **Claude Code** — skill in `~/.claude/skills/`, MCP in `.mcp.json` or `~/.claude/settings.json`
- **Cursor** — skill as Cursor rule, MCP in Cursor settings
- **VS Code** — skill as task/snippet, MCP in VS Code settings
- **Codex** — skill in Codex config, MCP in Codex settings
- **OpenCode** — skill in OpenCode config, MCP in OpenCode settings

The `npx pipeit` CLI detects the environment and writes to the correct locations.

## Web Reader (PWA)

### Layout

**Header bar:**

```
┌──────────────────────────────────────────┐
│ [≡ TOC]                    [🔍] [⌘K] (●) │
└──────────────────────────────────────────┘
```

- **Top-left:** TOC toggle button — opens/closes table of contents sidebar (slides in from left, auto-generated from document headings)
- **Top-right:** Search button + `Cmd/Ctrl+K` keyboard shortcut hint + user avatar with dropdown menu (logout, settings)
- Both search button click and `Cmd/Ctrl+K` open the same search/list panel

**Content area:**
- Centered, readable max-width (~720px)
- Reading progress bar at the bottom of viewport

### Search/List Panel

Opens from the right on desktop (side panel), full width on mobile.

**Panel layout:**

```
┌─────────────────────────────────────┐
│ 🔍 Search docs...  [Reading ↻] [All ↻] │
├─────────────────────────────────────┤
│ Architecture Decision Record         │
│ v3 · 2h ago        ██░░ 35%  priv   │
├─────────────────────────────────────┤
│ API Design Guidelines                │
│ v1 · 1d ago        ████ 100% pub    │
├─────────────────────────────────────┤
│ Sprint Retro Notes                   │
│ v1 · 3d ago        ░░░░ 0%   priv   │
└─────────────────────────────────────┘
```

**Search input** at top with text search.

**Two cycling filter buttons** to the right of search:
- **Read state:** cycles `All → Not started → Reading → Finished`
- **Visibility:** cycles `All → Private → Public`

**Each doc item shows:**
- Title
- Version + relative age
- Read progress bar + percentage (green at 100%, amber when partial, gray at 0%)
- Private/public badge

### Light/Dark Mode

- Respects system preference by default (`prefers-color-scheme`)
- User can override via toggle in the avatar dropdown menu (persisted in localStorage)

### Markdown Rendering

Using `react-markdown` with remark/rehype plugin ecosystem:

| Feature | Plugin |
|---------|--------|
| GitHub Flavored Markdown | `remark-gfm` |
| Syntax highlighting | `rehype-prism-plus` or `rehype-highlight` |
| LaTeX math | `remark-math` + `rehype-katex` |
| Mermaid diagrams | `rehype-mermaid` (or client-side Mermaid.js) |
| Heading anchors | `rehype-slug` + `rehype-autolink-headings` |

### Reading Position Tracking

- Saves on scroll, debounced (every 2-3 seconds)
- `PUT /api/docs/:slug/position` with `{ scroll_pct, heading_id }`
- `heading_id` = nearest heading anchor above current viewport
- On revisit: scroll to `heading_id` first (resilient across doc edits that change content length), fall back to `scroll_pct`
- Position is per-user per-doc, stored server-side → syncs across devices (phone ↔ desktop)

### PWA

**Service worker:**
- Caches app shell (HTML, CSS, JS) for instant load
- Does NOT cache doc content offline (private, server-authoritative)
- App loads from cache, fetches fresh content from API

**Push notifications:**
- Triggered when a doc the user has previously opened gets a new version ("Architecture Decision Record was updated (v3)")
- Triggered when a new public doc is shared via a link the user opens (future updates notify)
- Uses Web Push API with VAPID keys

**Install prompt:**
- After first doc view, subtle non-blocking banner: "Add pipeit to home screen for notifications"

## Auth Pages

**Sign-in page** (shown on first visit or when session expired):

```
┌──────────────────────────────┐
│        Sign in to pipeit    │
│                              │
│  [ Continue with Google  ]   │
│  [ Continue with GitHub  ]   │
│                              │
│  ─── or ───                  │
│                              │
│  Email: [________________]   │
│  Password: [_____________]   │
│  [ Sign in ]                 │
│                              │
│  Don't have an account?      │
│  Sign up · Forgot password   │
└──────────────────────────────┘
```

## Deployment

- **Docker image:** single container serving Hono (API + static PWA assets)
- **Kubernetes:** `pipeit` namespace on Leadfy AKS cluster
- **Database:** PostgreSQL 17, own instance in namespace
- **Deploy tool:** kdep (same patterns as nemo_meet)
- **Registry:** `leadfycr.azurecr.io`
- **Ingress:** nginx ingress + cert-manager for TLS
- **Domains:** `pipeit.live`

### kdep Structure

```
kdep/
  web/
    app.yml        ← Hono server (API + static), port 3001
    secrets.yml    ← DATABASE_URL, GOOGLE_CLIENT_ID/SECRET, GITHUB_CLIENT_ID/SECRET, VAPID keys
    state.yml      ← replicas, image tag
  postgres/
    app.yml        ← PostgreSQL 17
    secrets.yml    ← POSTGRES_PASSWORD
    state.yml      ← storage size, image tag
```

## Security

- **Rate limiting** on all endpoints (per-user for authenticated, per-IP for public)
- **CSRF protection** on auth endpoints
- **Secure session cookies** (httpOnly, secure, sameSite)
- **bcrypt** for email/password hashing
- **Input sanitization** — markdown content is rendered client-side via react-markdown (which doesn't execute raw HTML by default), but server validates content size limits
- **Doc access control** — private docs return 404 (not 403) for unauthenticated requests to avoid leaking doc existence
- **Content size limit** — max 1MB per document
