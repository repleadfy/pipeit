# MCP Remote Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a remote MCP server to pipeit so any AI tool (Claude Code, Cursor, ChatGPT, etc.) can pipe markdown via `https://pipeit.live/mcp` with OAuth authentication.

**Architecture:** MCP tools defined in `packages/mcp/`, mounted into the Hono server at `/mcp`. Uses `@modelcontextprotocol/hono` for Streamable HTTP transport. OAuth 2.0 authorization code flow reuses existing Google/GitHub auth. Tools call the database directly (same process).

**Tech Stack:** `@modelcontextprotocol/server`, `@modelcontextprotocol/hono`, Hono, Drizzle ORM, jose (JWT), zod

---

## File Structure

```
packages/mcp/
  package.json
  tsconfig.json
  src/
    index.ts              # McpServer setup + tool registrations, exports Hono sub-app
    tools/
      upload.ts           # pipeit_upload tool handler
      list.ts             # pipeit_list tool handler
      delete.ts           # pipeit_delete tool handler
      toggle.ts           # pipeit_toggle tool handler
    oauth.ts              # OAuth endpoints: authorize, token, metadata
    auth.ts               # Bearer token verification middleware for MCP routes

packages/server/src/
  app.ts                  # MODIFY: mount MCP routes at /mcp/*
```

## Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `@modelcontextprotocol/server` | packages/mcp | McpServer, tool registration |
| `@modelcontextprotocol/hono` | packages/mcp | Hono integration, WebStandardStreamableHTTPServerTransport |
| `zod` | packages/mcp | Tool input schema validation |
| `@pipeit/shared` | packages/mcp | DB access, schema |
| `jose` | packages/mcp (already in server) | JWT sign/verify for OAuth tokens |
| `nanoid` | packages/mcp (already in shared) | Auth code generation |

## Task Dependency Graph

```
Task 1 (package setup)
  └─► Task 2 (OAuth endpoints)
       └─► Task 3 (Bearer auth middleware)
            └─► Task 4 (pipeit_upload tool)
            └─► Task 5 (pipeit_list tool)
            └─► Task 6 (pipeit_delete tool)
            └─► Task 7 (pipeit_toggle tool)
                 └─► Task 8 (mount in server + integration)
                      └─► Task 9 (build + deploy)
```

Tasks 4-7 are independent of each other (can be parallelized after Task 3).

---

## Task 1: Package Setup

**Files:**
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/src/index.ts` (stub)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@pipeit/mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^2.0.0",
    "@modelcontextprotocol/hono": "^0.1.0",
    "@pipeit/shared": "*",
    "hono": "^4.12.8",
    "jose": "^6.2.2",
    "nanoid": "^5.1.7",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.3",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

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

- [ ] **Step 3: Create stub index.ts**

```typescript
import { Hono } from "hono";

const mcpApp = new Hono();

mcpApp.get("/health", (c) => c.json({ status: "ok", service: "mcp" }));

export { mcpApp };
```

- [ ] **Step 4: Install dependencies**

Run: `yarn install`

- [ ] **Step 5: Verify build**

Run: `yarn workspace @pipeit/mcp run build`
Expected: Compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/
git commit -m "feat(mcp): scaffold MCP server package"
```

---

## Task 2: OAuth Endpoints

The MCP spec requires OAuth 2.0 for remote server auth. Clients discover auth endpoints via `/.well-known/oauth-authorization-server`. The flow:

1. MCP client hits `/mcp`, gets 401 with auth metadata URL
2. Client fetches `/.well-known/oauth-authorization-server`
3. Client redirects user to `/mcp/authorize?client_id=...&redirect_uri=...&state=...&code_challenge=...`
4. User sees login page, picks Google or GitHub
5. After OAuth, server generates an authorization code and redirects to `redirect_uri?code=...&state=...`
6. Client exchanges code for access token at `POST /mcp/token`

**Files:**
- Create: `packages/mcp/src/oauth.ts`

- [ ] **Step 1: Create oauth.ts with metadata endpoint**

The `/.well-known/oauth-authorization-server` endpoint will be mounted in the main server app (Task 8), but we define the route handler here.

```typescript
import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import * as jose from "jose";
import { eq } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { users } from "@pipeit/shared/db/schema";

// In-memory auth code store (short-lived, 5 min TTL)
const authCodes = new Map<string, { userId: string; redirectUri: string; codeChallenge: string; expiresAt: number }>();

// Clean expired codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authCodes) {
    if (data.expiresAt < now) authCodes.delete(code);
  }
}, 60_000);

const oauthApp = new Hono();

// OAuth metadata — mounted at /.well-known/oauth-authorization-server by the main app
oauthApp.get("/metadata", (c) => {
  const base = new URL(c.req.url).origin;
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/mcp/authorize`,
    token_endpoint: `${base}/mcp/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

// Authorization endpoint — shows login options
// MCP client redirects here with: client_id, redirect_uri, state, code_challenge, code_challenge_method
oauthApp.get("/authorize", (c) => {
  const clientId = c.req.query("client_id") ?? "";
  const redirectUri = c.req.query("redirect_uri") ?? "";
  const state = c.req.query("state") ?? "";
  const codeChallenge = c.req.query("code_challenge") ?? "";
  const codeChallengeMethod = c.req.query("code_challenge_method") ?? "S256";

  if (!redirectUri || !codeChallenge) {
    return c.json({ error: "missing redirect_uri or code_challenge" }, 400);
  }

  // Store OAuth params in a short-lived cookie so we can retrieve them after the user logs in
  const oauthState = JSON.stringify({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod });
  setCookie(c, "mcp_oauth_state", oauthState, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  // Render a simple login page with Google/GitHub buttons
  const base = new URL(c.req.url).origin;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>pipeit — Sign In</title>
<style>
  body { font-family: system-ui; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { background: #1e293b; padding: 2rem; border-radius: 12px; text-align: center; max-width: 360px; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; }
  a { display: block; padding: 0.75rem; margin: 0.5rem 0; border-radius: 8px; text-decoration: none; color: white; font-weight: 500; }
  .google { background: #4285f4; }
  .github { background: #333; }
</style></head>
<body><div class="card">
  <h1>pipeit</h1>
  <p>Sign in to connect your AI tool</p>
  <a class="google" href="${base}/auth/google?mcp_oauth=1">Continue with Google</a>
  <a class="github" href="${base}/auth/github?mcp_oauth=1">Continue with GitHub</a>
</div></body></html>`;

  return c.html(html);
});

// Called after Google/GitHub OAuth completes — generates auth code and redirects to MCP client
// The existing OAuth callbacks need to check for mcp_oauth=1 and redirect here instead of WEB_URL
oauthApp.get("/callback", async (c) => {
  const userId = c.req.query("user_id");
  const oauthStateCookie = getCookie(c, "mcp_oauth_state");

  if (!userId || !oauthStateCookie) {
    return c.json({ error: "missing user_id or oauth state" }, 400);
  }

  const { redirectUri, state, codeChallenge } = JSON.parse(oauthStateCookie);

  // Generate authorization code
  const code = nanoid(32);
  authCodes.set(code, {
    userId,
    redirectUri,
    codeChallenge,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
  });

  // Clear the oauth state cookie
  setCookie(c, "mcp_oauth_state", "", { maxAge: 0, path: "/" });

  // Redirect back to MCP client with the code
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

// Token exchange endpoint
oauthApp.post("/token", async (c) => {
  const body = await c.req.parseBody();
  const grantType = body.grant_type as string;
  const code = body.code as string;
  const codeVerifier = body.code_verifier as string;
  const redirectUri = body.redirect_uri as string;

  if (grantType !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  const authCode = authCodes.get(code);
  if (!authCode) {
    return c.json({ error: "invalid_grant", error_description: "invalid or expired code" }, 400);
  }

  // Verify PKCE code_verifier against stored code_challenge (S256)
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
  const computedChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  if (computedChallenge !== authCode.codeChallenge) {
    return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
  }

  if (authCode.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  }

  // Delete used code
  authCodes.delete(code);

  // Look up user and generate access token
  const user = (await db.select().from(users).where(eq(users.id, authCode.userId)).limit(1))[0];
  if (!user) {
    return c.json({ error: "invalid_grant", error_description: "user not found" }, 400);
  }

  // Sign a JWT access token (long-lived for MCP — 90 days)
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const accessToken = await new jose.SignJWT({ sub: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret);

  return c.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 90 * 24 * 60 * 60,
  });
});

export { oauthApp, authCodes };
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace @pipeit/mcp run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/oauth.ts
git commit -m "feat(mcp): OAuth authorization + token exchange endpoints"
```

---

## Task 3: Bearer Token Auth Middleware for MCP

**Files:**
- Create: `packages/mcp/src/auth.ts`

- [ ] **Step 1: Create auth.ts**

This middleware verifies Bearer tokens on MCP tool requests. If no valid token, returns 401 with the auth metadata URL so the MCP client can start the OAuth flow.

```typescript
import type { Context, Next } from "hono";
import * as jose from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export interface McpUser {
  sub: string;
  email: string;
  name?: string;
}

declare module "hono" {
  interface ContextVariableMap {
    mcpUser: McpUser;
  }
}

export async function mcpAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    const base = new URL(c.req.url).origin;
    c.header("WWW-Authenticate", `Bearer resource_metadata="${base}/.well-known/oauth-authorization-server"`);
    return c.json({ error: "unauthorized" }, 401);
  }

  try {
    const { payload } = await jose.jwtVerify(token, secret);
    c.set("mcpUser", { sub: payload.sub as string, email: payload.email as string, name: payload.name as string | undefined });
    return next();
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace @pipeit/mcp run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/auth.ts
git commit -m "feat(mcp): Bearer token auth middleware with OAuth discovery"
```

---

## Task 4: pipeit_upload Tool

**Files:**
- Create: `packages/mcp/src/tools/upload.ts`

- [ ] **Step 1: Create upload.ts**

```typescript
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { docs } from "@pipeit/shared/db/schema";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerUploadTool(server: McpServer, getUserId: () => string, getBaseUrl: () => string) {
  server.registerTool(
    "pipeit_upload",
    {
      description: "Upload or update a markdown document on pipeit. If file_path is provided and a doc exists with the same path, it updates in place. Otherwise creates a new doc.",
      inputSchema: z.object({
        content: z.string().describe("Markdown content to upload"),
        file_path: z.string().optional().describe("Original file path — used for update-in-place matching"),
        is_public: z.boolean().optional().default(false).describe("Make the document publicly shareable"),
      }),
    },
    async ({ content, file_path, is_public }) => {
      const userId = getUserId();
      const baseUrl = getBaseUrl();

      if (!content) {
        return { content: [{ type: "text" as const, text: "Error: content is required" }], isError: true };
      }
      if (content.length > 1_000_000) {
        return { content: [{ type: "text" as const, text: "Error: content exceeds 1MB limit" }], isError: true };
      }

      const title = content.match(/^#\s+(.+)$/m)?.[1] ?? "Untitled";

      // Update-in-place if same user + same file_path
      if (file_path) {
        const existing = await db.select().from(docs)
          .where(and(eq(docs.userId, userId), eq(docs.filePath, file_path)))
          .limit(1);

        if (existing.length > 0) {
          const doc = existing[0];
          await db.update(docs).set({
            content,
            title,
            version: doc.version + 1,
            isPublic: is_public ?? doc.isPublic,
            updatedAt: new Date(),
          }).where(eq(docs.id, doc.id));

          const url = `${baseUrl}/d/${doc.slug}`;
          return { content: [{ type: "text" as const, text: `Updated: ${url} (v${doc.version + 1})` }] };
        }
      }

      // Create new doc
      const slug = nanoid(10);
      await db.insert(docs).values({
        userId,
        slug,
        filePath: file_path ?? null,
        title,
        content,
        isPublic: is_public ?? false,
      });

      const url = `${baseUrl}/d/${slug}`;
      return { content: [{ type: "text" as const, text: `Created: ${url}` }] };
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace @pipeit/mcp run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/tools/upload.ts
git commit -m "feat(mcp): pipeit_upload tool — create/update markdown docs"
```

---

## Task 5: pipeit_list Tool

**Files:**
- Create: `packages/mcp/src/tools/list.ts`

- [ ] **Step 1: Create list.ts**

```typescript
import { z } from "zod";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { docs, readingPositions } from "@pipeit/shared/db/schema";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerListTool(server: McpServer, getUserId: () => string) {
  server.registerTool(
    "pipeit_list",
    {
      description: "List your documents on pipeit. Supports search, read state, and visibility filters.",
      inputSchema: z.object({
        q: z.string().optional().describe("Search query to filter by title"),
        read_state: z.enum(["not_started", "reading", "finished"]).optional().describe("Filter by reading progress"),
        visibility: z.enum(["public", "private"]).optional().describe("Filter by visibility"),
      }),
    },
    async ({ q, read_state, visibility }) => {
      const userId = getUserId();

      const userDocs = await db
        .select({
          slug: docs.slug,
          title: docs.title,
          version: docs.version,
          isPublic: docs.isPublic,
          updatedAt: docs.updatedAt,
          readPct: readingPositions.scrollPct,
        })
        .from(docs)
        .leftJoin(readingPositions, and(
          eq(readingPositions.docId, docs.id),
          eq(readingPositions.userId, userId),
        ))
        .where(and(
          eq(docs.userId, userId),
          q ? ilike(docs.title, `%${q}%`) : undefined,
          visibility === "public" ? eq(docs.isPublic, true) : undefined,
          visibility === "private" ? eq(docs.isPublic, false) : undefined,
        ))
        .orderBy(sql`${docs.updatedAt} DESC`);

      let filtered = userDocs;
      if (read_state === "not_started") filtered = userDocs.filter((d) => d.readPct === null || d.readPct === 0);
      if (read_state === "reading") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct > 0 && d.readPct < 1);
      if (read_state === "finished") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct >= 1);

      const text = filtered.length === 0
        ? "No documents found."
        : filtered.map((d) =>
            `- **${d.title}** (${d.isPublic ? "public" : "private"}) — v${d.version}, ${d.updatedAt.toISOString().slice(0, 10)} — /d/${d.slug}`
          ).join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace @pipeit/mcp run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/tools/list.ts
git commit -m "feat(mcp): pipeit_list tool — list docs with filters"
```

---

## Task 6: pipeit_delete Tool

**Files:**
- Create: `packages/mcp/src/tools/delete.ts`

- [ ] **Step 1: Create delete.ts**

```typescript
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { docs } from "@pipeit/shared/db/schema";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerDeleteTool(server: McpServer, getUserId: () => string) {
  server.registerTool(
    "pipeit_delete",
    {
      description: "Delete a document from pipeit by its slug.",
      inputSchema: z.object({
        slug: z.string().describe("The document slug (from the URL /d/<slug>)"),
      }),
    },
    async ({ slug }) => {
      const userId = getUserId();

      const existing = await db.select({ id: docs.id }).from(docs)
        .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
        .limit(1);

      if (existing.length === 0) {
        return { content: [{ type: "text" as const, text: `Error: document "${slug}" not found or not owned by you.` }], isError: true };
      }

      await db.delete(docs).where(eq(docs.id, existing[0].id));
      return { content: [{ type: "text" as const, text: `Deleted: /d/${slug}` }] };
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace @pipeit/mcp run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/tools/delete.ts
git commit -m "feat(mcp): pipeit_delete tool — delete docs by slug"
```

---

## Task 7: pipeit_toggle Tool

**Files:**
- Create: `packages/mcp/src/tools/toggle.ts`

- [ ] **Step 1: Create toggle.ts**

```typescript
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { docs } from "@pipeit/shared/db/schema";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerToggleTool(server: McpServer, getUserId: () => string, getBaseUrl: () => string) {
  server.registerTool(
    "pipeit_toggle",
    {
      description: "Toggle a document's visibility between public and private.",
      inputSchema: z.object({
        slug: z.string().describe("The document slug"),
        is_public: z.boolean().describe("Set to true for public, false for private"),
      }),
    },
    async ({ slug, is_public }) => {
      const userId = getUserId();
      const baseUrl = getBaseUrl();

      const existing = await db.select({ id: docs.id }).from(docs)
        .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
        .limit(1);

      if (existing.length === 0) {
        return { content: [{ type: "text" as const, text: `Error: document "${slug}" not found or not owned by you.` }], isError: true };
      }

      await db.update(docs).set({ isPublic: is_public }).where(eq(docs.id, existing[0].id));
      const status = is_public ? "public" : "private";
      const url = `${baseUrl}/d/${slug}`;
      return { content: [{ type: "text" as const, text: `${url} is now ${status}` }] };
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace @pipeit/mcp run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/tools/toggle.ts
git commit -m "feat(mcp): pipeit_toggle tool — toggle doc visibility"
```

---

## Task 8: Wire Up McpServer + Mount in Hono App

**Files:**
- Modify: `packages/mcp/src/index.ts` (replace stub)
- Modify: `packages/server/src/app.ts` (mount MCP routes)
- Modify: `packages/server/src/auth/google.ts` (MCP OAuth redirect support)
- Modify: `packages/server/src/auth/github.ts` (MCP OAuth redirect support)

- [ ] **Step 1: Update packages/mcp/src/index.ts — full MCP server setup**

Replace the stub with the full implementation. Each MCP request creates a fresh McpServer instance with per-request user context (the authenticated user from the Bearer token).

```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/hono";
import { Hono } from "hono";
import { oauthApp } from "./oauth.js";
import { mcpAuthMiddleware } from "./auth.js";
import { registerUploadTool } from "./tools/upload.js";
import { registerListTool } from "./tools/list.js";
import { registerDeleteTool } from "./tools/delete.js";
import { registerToggleTool } from "./tools/toggle.js";

const mcpApp = new Hono();

// OAuth routes (authorize, callback, token)
mcpApp.route("/", oauthApp);

// MCP Streamable HTTP endpoint — requires Bearer auth
mcpApp.all("/", mcpAuthMiddleware, async (c) => {
  const user = c.get("mcpUser");
  const baseUrl = new URL(c.req.url).origin;

  // Create per-request server with user context
  const server = new McpServer({
    name: "pipeit",
    version: "0.1.0",
  });

  const getUserId = () => user.sub;
  const getBaseUrl = () => baseUrl;

  registerUploadTool(server, getUserId, getBaseUrl);
  registerListTool(server, getUserId);
  registerDeleteTool(server, getUserId);
  registerToggleTool(server, getUserId, getBaseUrl);

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  return transport.handleRequest(c.req.raw);
});

export { mcpApp };
```

- [ ] **Step 2: Mount MCP routes in server app.ts**

Add to `packages/server/src/app.ts`, after the existing route mounts (after `app.route("/api/push", pushRouter);`) and before the static file serving:

```typescript
import { mcpApp } from "@pipeit/mcp";

// MCP remote server
app.route("/mcp", mcpApp);

// OAuth metadata discovery
app.get("/.well-known/oauth-authorization-server", (c) => {
  const base = new URL(c.req.url).origin;
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/mcp/authorize`,
    token_endpoint: `${base}/mcp/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});
```

- [ ] **Step 3: Update Google OAuth to support MCP redirect**

In `packages/server/src/auth/google.ts`, modify the callback to check for `mcp_oauth` cookie and redirect to `/mcp/callback` instead of `WEB_URL`:

Find the end of the Google callback handler where it does `return c.redirect(env.WEB_URL);` and replace with:

```typescript
  // Check if this is an MCP OAuth flow
  const mcpOauthState = getCookie(c, "mcp_oauth_state");
  if (mcpOauthState) {
    return c.redirect(`${env.PUBLIC_URL}/mcp/callback?user_id=${userId}`);
  }

  return c.redirect(env.WEB_URL);
```

Add `getCookie` to the import from `hono/cookie` if not already imported.

- [ ] **Step 4: Update GitHub OAuth to support MCP redirect**

Same change in `packages/server/src/auth/github.ts`. Find `return c.redirect(env.WEB_URL);` at the end of the callback and replace with:

```typescript
  // Check if this is an MCP OAuth flow
  const mcpOauthState = getCookie(c, "mcp_oauth_state");
  if (mcpOauthState) {
    return c.redirect(`${env.PUBLIC_URL}/mcp/callback?user_id=${userId}`);
  }

  return c.redirect(env.WEB_URL);
```

Add `getCookie` to the import from `hono/cookie` if not already imported.

- [ ] **Step 5: Add @pipeit/mcp dependency to server**

In `packages/server/package.json`, add to dependencies:

```json
"@pipeit/mcp": "*"
```

- [ ] **Step 6: Update root build script**

In root `package.json`, update the build script to include mcp:

```json
"build": "yarn workspace @pipeit/shared run build && yarn workspace @pipeit/mcp run build && yarn workspace @pipeit/server run build && yarn workspace web run build"
```

- [ ] **Step 7: Verify full build**

Run: `yarn install && yarn build`
Expected: All workspaces compile without errors.

- [ ] **Step 8: Commit**

```bash
git add packages/mcp/src/index.ts packages/server/src/app.ts packages/server/src/auth/google.ts packages/server/src/auth/github.ts packages/server/package.json package.json
git commit -m "feat(mcp): wire up MCP server with tools + OAuth, mount at /mcp"
```

---

## Task 9: Docker Build Update + Deploy

**Files:**
- Modify: `docker/Dockerfile.server` (copy mcp package)

- [ ] **Step 1: Update Dockerfile.server**

Add the mcp package to the Docker build. In the builder stage, after the existing COPY lines for packages:

```dockerfile
COPY packages/mcp/package.json packages/mcp/
```

And update the build command:

```dockerfile
RUN yarn workspace @pipeit/shared run build \
 && yarn workspace @pipeit/mcp run build \
 && yarn workspace @pipeit/server run build \
 && yarn workspace web run build
```

In the production stage, add after the shared dist copy:

```dockerfile
COPY --from=builder /app/packages/mcp/package.json ./packages/mcp/package.json
COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist
```

- [ ] **Step 2: Build, push, deploy**

```bash
kdep build web --platform linux/amd64
kdep push web
kdep apply web
kubectl rollout restart deployment/pipeit-web -n pipeit
```

- [ ] **Step 3: Verify MCP endpoint**

```bash
curl -s https://pipeit.live/.well-known/oauth-authorization-server
# Should return JSON with authorization_endpoint and token_endpoint

curl -s https://pipeit.live/mcp -X POST
# Should return 401 with WWW-Authenticate header
```

- [ ] **Step 4: Commit**

```bash
git add docker/Dockerfile.server
git commit -m "feat(mcp): update Docker build for MCP package + deploy"
```

---

## Summary

| Task | What | Depends On |
|------|------|-----------|
| 1 | Package scaffold | — |
| 2 | OAuth endpoints (authorize, token, PKCE) | 1 |
| 3 | Bearer auth middleware | 1 |
| 4 | pipeit_upload tool | 1 |
| 5 | pipeit_list tool | 1 |
| 6 | pipeit_delete tool | 1 |
| 7 | pipeit_toggle tool | 1 |
| 8 | Wire up McpServer + mount in app | 2, 3, 4, 5, 6, 7 |
| 9 | Docker build + deploy | 8 |
