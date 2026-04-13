# mpipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build mpipe — a service that pipes markdown from AI conversations to a polished PWA reader at mpipe.dev.

**Architecture:** Yarn workspaces monorepo with three packages (shared, server, web). Hono API serves both REST endpoints and static PWA assets from a single container. Deployed to Leadfy K8s via kdep. Follows nemo_meet patterns exactly: ESM everywhere, `.js` import extensions, Drizzle ORM, React 19 + Vite 8 + Tailwind v4.

**Tech Stack:** TypeScript, Hono, React 19, Vite 8, Tailwind CSS v4, Drizzle ORM, PostgreSQL 17, react-markdown, Web Push API, MCP SDK

---

## File Structure

```
mpipe/
├── package.json                          # root workspace config
├── .yarnrc                               # nodeLinker: node-modules
├── drizzle.config.ts                     # Drizzle Kit config
├── tsconfig.base.json                    # shared TS config
├── docker/
│   ├── docker-compose.yml                # local dev: postgres + server + web
│   ├── Dockerfile.server                 # production server image
│   └── Dockerfile.web-dev                # dev web with hot reload
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                  # re-exports
│   │       ├── db/
│   │       │   ├── index.ts              # db connection (postgres driver)
│   │       │   └── schema.ts             # all Drizzle tables + enums
│   │       └── types.ts                  # shared API types (request/response shapes)
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                  # serve() entry point
│   │       ├── app.ts                    # Hono app, route assembly, cors
│   │       ├── env.ts                    # env var validation
│   │       ├── auth/
│   │       │   ├── middleware.ts          # JWT verification, c.set('user')
│   │       │   ├── jwt.ts                # sign/verify JWT helpers
│   │       │   ├── google.ts             # Google OAuth routes
│   │       │   ├── github.ts             # GitHub OAuth routes
│   │       │   └── email.ts              # email/password routes
│   │       ├── routes/
│   │       │   ├── docs.ts               # CRUD + upload + list with filters
│   │       │   ├── position.ts           # reading position save/load
│   │       │   └── push.ts               # push subscription management
│   │       ├── services/
│   │       │   └── push.ts               # web-push notification sender
│   │       ├── middleware/
│   │       │   └── rate-limit.ts         # per-user + per-IP rate limiting
│   │       ├── docs.test.ts              # doc route tests
│   │       └── auth.test.ts              # auth route tests
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx                  # createRoot entry
│           ├── index.css                 # @import "tailwindcss"
│           ├── App.tsx                   # Router + AuthProvider + Routes
│           ├── lib/
│           │   ├── api.ts                # fetch wrapper with auth
│           │   ├── auth.tsx              # AuthContext + useAuth hook
│           │   └── push.ts              # push subscription helpers
│           ├── pages/
│           │   ├── LoginPage.tsx         # Google/GitHub/email sign-in
│           │   ├── AuthCallbackPage.tsx  # OAuth callback handler
│           │   ├── DocPage.tsx           # markdown reader (main view)
│           │   └── NotFoundPage.tsx      # 404
│           ├── components/
│           │   ├── Header.tsx            # top bar: TOC btn, search btn, avatar
│           │   ├── MarkdownRenderer.tsx  # react-markdown + all plugins
│           │   ├── TOCSidebar.tsx        # table of contents (left slide-in)
│           │   ├── SearchPanel.tsx       # doc list + search + filters (right panel)
│           │   ├── DocListItem.tsx       # single doc in search panel
│           │   ├── ReadingProgress.tsx   # bottom progress bar
│           │   ├── AvatarMenu.tsx        # avatar dropdown (logout, dark mode)
│           │   └── CycleFilter.tsx       # cycling filter button component
│           ├── hooks/
│           │   ├── useReadingPosition.ts # scroll tracking + restore
│           │   ├── useTheme.ts           # light/dark mode
│           │   └── useKeyboard.ts        # Cmd+K handler
│           └── sw.ts                     # service worker (app shell caching)
├── skills/
│   └── mpipe/
│       └── SKILL.md                      # /mpipe skill for Claude Code
├── kdep/
│   ├── web/
│   │   ├── app.yml
│   │   ├── secrets.yml
│   │   └── state.yml
│   └── postgres/
│       ├── app.yml
│       ├── secrets.yml
│       └── state.yml
└── drizzle/                              # generated migrations
```

---

## Task 1: Monorepo Scaffold + Shared Package

**Files:**
- Create: `package.json`, `.yarnrc`, `tsconfig.base.json`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`, `packages/shared/src/db/index.ts`, `packages/shared/src/db/schema.ts`, `packages/shared/src/types.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "mpipe",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:server": "yarn workspace @mpipe/server run dev",
    "dev:web": "yarn workspace web run dev",
    "build": "yarn workspace @mpipe/shared run build && yarn workspace @mpipe/server run build && yarn workspace web run build",
    "build:server": "yarn workspace @mpipe/shared run build && yarn workspace @mpipe/server run build"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.10"
  },
  "dependencies": {
    "esbuild": "^0.27.4"
  },
  "packageManager": "yarn@1.22.22"
}
```

- [ ] **Step 2: Create .yarnrc**

```
nodeLinker: node-modules
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 4: Create packages/shared/package.json**

```json
{
  "name": "@mpipe/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./db": "./dist/db/index.js",
    "./db/schema": "./dist/db/schema.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.7",
    "nanoid": "^5.1.7"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 5: Create packages/shared/tsconfig.json**

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

- [ ] **Step 6: Create packages/shared/src/db/schema.ts**

```typescript
import { pgTable, uuid, text, timestamp, integer, boolean, doublePrecision, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";

export const authProviderEnum = pgEnum("auth_provider", ["google", "github", "email"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authIdentities = pgTable("auth_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: authProviderEnum("provider").notNull(),
  providerId: text("provider_id").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("auth_identities_provider_provider_id_idx").on(table.provider, table.providerId),
]);

export const docs = pgTable("docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  filePath: text("file_path"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("docs_user_id_file_path_idx").on(table.userId, table.filePath),
]);

export const readingPositions = pgTable("reading_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  docId: uuid("doc_id").notNull().references(() => docs.id, { onDelete: "cascade" }),
  scrollPct: doublePrecision("scroll_pct").notNull(),
  headingId: text("heading_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("reading_positions_user_doc_idx").on(table.userId, table.docId),
]);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("push_subscriptions_user_endpoint_idx").on(table.userId, table.endpoint),
]);
```

- [ ] **Step 7: Create packages/shared/src/db/index.ts**

```typescript
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

- [ ] **Step 8: Create packages/shared/src/types.ts**

```typescript
export interface DocUploadRequest {
  content: string;
  file_path?: string;
  is_public?: boolean;
}

export interface DocUploadResponse {
  slug: string;
  url: string;
  is_new: boolean;
}

export interface DocResponse {
  slug: string;
  title: string;
  content: string;
  version: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  author: { name: string; avatar_url: string | null };
}

export interface DocListItem {
  slug: string;
  title: string;
  version: number;
  is_public: boolean;
  updated_at: string;
  read_pct: number | null;
}

export interface PositionPayload {
  scroll_pct: number;
  heading_id?: string;
}
```

- [ ] **Step 9: Create packages/shared/src/index.ts**

```typescript
export * from "./types.js";
export * from "./db/schema.js";
```

- [ ] **Step 10: Create drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/shared/src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 11: Install dependencies and build shared**

Run: `yarn install && yarn workspace @mpipe/shared run build`
Expected: clean compile, `packages/shared/dist/` created

- [ ] **Step 12: Generate initial migration**

Run: `DATABASE_URL=postgresql://localhost/mpipe yarn drizzle-kit generate`
Expected: `drizzle/0000_init.sql` created with CREATE TABLE statements

- [ ] **Step 13: Commit**

```bash
git add package.json .yarnrc tsconfig.base.json drizzle.config.ts packages/shared/ drizzle/
git commit -m "feat: monorepo scaffold + shared package with Drizzle schema"
```

---

## Task 2: Server — Hono App Shell + Health Endpoint

**Files:**
- Create: `packages/server/package.json`, `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`, `packages/server/src/app.ts`, `packages/server/src/env.ts`

- [ ] **Step 1: Create packages/server/package.json**

```json
{
  "name": "@mpipe/server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "node --import tsx --test src/*.test.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.19.11",
    "@mpipe/shared": "*",
    "hono": "^4.12.8",
    "jose": "^6.2.2",
    "nanoid": "^5.1.7",
    "bcrypt": "^5.1.1",
    "web-push": "^3.6.7"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "@types/bcrypt": "^5.0.2",
    "@types/web-push": "^3.6.4",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create packages/server/tsconfig.json**

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

- [ ] **Step 3: Create packages/server/src/env.ts**

```typescript
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? "",
  PUBLIC_URL: process.env.PUBLIC_URL ?? "http://localhost:3001",
  WEB_URL: process.env.WEB_URL ?? "http://localhost:5173",
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY ?? "",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? "",
  VAPID_EMAIL: process.env.VAPID_EMAIL ?? "mailto:admin@mpipe.dev",
};
```

- [ ] **Step 4: Create packages/server/src/app.ts**

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";

const app = new Hono();

app.use("*", cors({
  origin: [env.WEB_URL, env.PUBLIC_URL],
  credentials: true,
}));

app.get("/health", (c) => c.json({ status: "ok" }));

export { app };
```

- [ ] **Step 5: Create packages/server/src/index.ts**

```typescript
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`mpipe server listening on port ${info.port}`);
});
```

- [ ] **Step 6: Install dependencies and test**

Run: `yarn install && JWT_SECRET=dev DATABASE_URL=postgresql://localhost/mpipe yarn dev:server`
Expected: `mpipe server listening on port 3001`

Test in another terminal: `curl http://localhost:3001/health`
Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add packages/server/
git commit -m "feat: Hono server shell with health endpoint"
```

---

## Task 3: Server — JWT Auth Middleware

**Files:**
- Create: `packages/server/src/auth/jwt.ts`, `packages/server/src/auth/middleware.ts`
- Create: `packages/server/src/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/auth.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { signJwt, verifyJwt } from "./auth/jwt.js";

describe("JWT", () => {
  it("signs and verifies a token", async () => {
    const payload = { sub: "user-123", email: "test@example.com" };
    const token = await signJwt(payload);
    assert.ok(typeof token === "string");
    const decoded = await verifyJwt(token);
    assert.equal(decoded.sub, "user-123");
    assert.equal(decoded.email, "test@example.com");
  });

  it("rejects invalid token", async () => {
    await assert.rejects(() => verifyJwt("invalid.token.here"), {
      name: "JOSEError",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && JWT_SECRET=test-secret DATABASE_URL=x node --import tsx --test src/auth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create packages/server/src/auth/jwt.ts**

```typescript
import * as jose from "jose";
import { env } from "../env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, secret);
  return payload as unknown as JwtPayload;
}
```

- [ ] **Step 4: Create packages/server/src/auth/middleware.ts**

```typescript
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyJwt, type JwtPayload } from "./jwt.js";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const token = getCookie(c, "token") ?? c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);

  try {
    const payload = await verifyJwt(token);
    c.set("user", payload);
    return next();
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/server && JWT_SECRET=test-secret DATABASE_URL=x node --import tsx --test src/auth.test.ts`
Expected: 2 tests PASS

- [ ] **Step 6: Wire middleware into app.ts**

Update `packages/server/src/app.ts` — add after health route:

```typescript
import { authMiddleware } from "./auth/middleware.js";

// ... existing health route ...

app.use("/api/*", authMiddleware);
```

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/auth/ packages/server/src/auth.test.ts packages/server/src/app.ts
git commit -m "feat: JWT auth middleware with sign/verify"
```

---

## Task 4: Server — Google OAuth

**Files:**
- Create: `packages/server/src/auth/google.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create packages/server/src/auth/google.ts**

```typescript
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { users, authIdentities } from "@mpipe/shared/db/schema";
import { signJwt } from "./jwt.js";
import { env } from "../env.js";

const google = new Hono();

google.get("/google", (c) => {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.PUBLIC_URL}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

google.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "missing code" }, 400);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.PUBLIC_URL}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json() as { access_token: string };

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json() as { id: string; email: string; name: string; picture: string };

  const existing = await db.select().from(authIdentities)
    .where(eq(authIdentities.providerId, profile.id))
    .limit(1);

  let userId: string;

  if (existing.length > 0) {
    userId = existing[0].userId;
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  } else {
    const existingUser = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      await db.insert(authIdentities).values({
        userId, provider: "google", providerId: profile.id, email: profile.email,
      });
    } else {
      const [newUser] = await db.insert(users).values({
        name: profile.name, email: profile.email, avatarUrl: profile.picture,
      }).returning();
      userId = newUser.id;
      await db.insert(authIdentities).values({
        userId, provider: "google", providerId: profile.id, email: profile.email,
      });
    }
  }

  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  const jwt = await signJwt({ sub: user.id, email: user.email, name: user.name });

  setCookie(c, "token", jwt, {
    httpOnly: true,
    secure: env.PUBLIC_URL.startsWith("https"),
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return c.redirect(env.WEB_URL);
});

export { google };
```

- [ ] **Step 2: Wire into app.ts**

Update `packages/server/src/app.ts`:

```typescript
import { google } from "./auth/google.js";

// after cors middleware, before authMiddleware:
app.route("/auth", google);
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/auth/google.ts packages/server/src/app.ts
git commit -m "feat: Google OAuth login with auto-account creation"
```

---

## Task 5: Server — GitHub OAuth + Email/Password Auth

**Files:**
- Create: `packages/server/src/auth/github.ts`, `packages/server/src/auth/email.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create packages/server/src/auth/github.ts**

```typescript
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { users, authIdentities } from "@mpipe/shared/db/schema";
import { signJwt } from "./jwt.js";
import { env } from "../env.js";

const github = new Hono();

github.get("/github", (c) => {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${env.PUBLIC_URL}/auth/github/callback`,
    scope: "user:email",
  });
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

github.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "missing code" }, 400);

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const { access_token } = await tokenRes.json() as { access_token: string };

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" },
  });
  const ghUser = await userRes.json() as { id: number; login: string; avatar_url: string; email: string | null };

  let email = ghUser.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" },
    });
    const emails = await emailsRes.json() as { email: string; primary: boolean }[];
    email = emails.find((e) => e.primary)?.email ?? emails[0]?.email ?? `${ghUser.id}@github.noreply`;
  }

  const providerId = String(ghUser.id);
  const existing = await db.select().from(authIdentities)
    .where(eq(authIdentities.providerId, providerId))
    .limit(1);

  let userId: string;

  if (existing.length > 0) {
    userId = existing[0].userId;
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  } else {
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      await db.insert(authIdentities).values({
        userId, provider: "github", providerId, email,
      });
    } else {
      const [newUser] = await db.insert(users).values({
        name: ghUser.login, email, avatarUrl: ghUser.avatar_url,
      }).returning();
      userId = newUser.id;
      await db.insert(authIdentities).values({
        userId, provider: "github", providerId, email,
      });
    }
  }

  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  const jwt = await signJwt({ sub: user.id, email: user.email, name: user.name });

  setCookie(c, "token", jwt, {
    httpOnly: true,
    secure: env.PUBLIC_URL.startsWith("https"),
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return c.redirect(env.WEB_URL);
});

export { github };
```

- [ ] **Step 2: Create packages/server/src/auth/email.ts**

```typescript
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db } from "@mpipe/shared/db";
import { users, authIdentities } from "@mpipe/shared/db/schema";
import { signJwt } from "./jwt.js";
import { env } from "../env.js";

const email = new Hono();

email.post("/email/signup", async (c) => {
  const body = await c.req.json<{ email: string; password: string; name: string }>();
  if (!body.email || !body.password || !body.name) {
    return c.json({ error: "email, password, and name are required" }, 400);
  }

  const existing = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  if (existing.length > 0) return c.json({ error: "email already registered" }, 409);

  const hash = await bcrypt.hash(body.password, 10);
  const [newUser] = await db.insert(users).values({
    name: body.name, email: body.email,
  }).returning();

  await db.insert(authIdentities).values({
    userId: newUser.id, provider: "email", providerId: hash, email: body.email,
  });

  const jwt = await signJwt({ sub: newUser.id, email: newUser.email, name: newUser.name });
  setCookie(c, "token", jwt, {
    httpOnly: true,
    secure: env.PUBLIC_URL.startsWith("https"),
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return c.json({ id: newUser.id, email: newUser.email, name: newUser.name });
});

email.post("/email/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  if (!body.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const identity = await db.select().from(authIdentities)
    .where(and(eq(authIdentities.provider, "email"), eq(authIdentities.email, body.email)))
    .limit(1);

  if (identity.length === 0) return c.json({ error: "invalid credentials" }, 401);

  const valid = await bcrypt.compare(body.password, identity[0].providerId);
  if (!valid) return c.json({ error: "invalid credentials" }, 401);

  const user = (await db.select().from(users).where(eq(users.id, identity[0].userId)).limit(1))[0];
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));

  const jwt = await signJwt({ sub: user.id, email: user.email, name: user.name });
  setCookie(c, "token", jwt, {
    httpOnly: true,
    secure: env.PUBLIC_URL.startsWith("https"),
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return c.json({ id: user.id, email: user.email, name: user.name });
});

export { email };
```

- [ ] **Step 3: Wire into app.ts and add /auth/me + /auth/logout**

Update `packages/server/src/app.ts`:

```typescript
import { github } from "./auth/github.js";
import { email } from "./auth/email.js";
import { getCookie, deleteCookie } from "hono/cookie";
import { verifyJwt } from "./auth/jwt.js";
import { eq } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { users } from "@mpipe/shared/db/schema";

app.route("/auth", github);
app.route("/auth", email);

app.get("/auth/me", async (c) => {
  const token = getCookie(c, "token");
  if (!token) return c.json({ user: null });
  try {
    const payload = await verifyJwt(token);
    const user = (await db.select().from(users).where(eq(users.id, payload.sub)).limit(1))[0];
    if (!user) return c.json({ user: null });
    return c.json({ user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatarUrl } });
  } catch {
    return c.json({ user: null });
  }
});

app.post("/auth/logout", (c) => {
  deleteCookie(c, "token", { path: "/" });
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/auth/github.ts packages/server/src/auth/email.ts packages/server/src/app.ts
git commit -m "feat: GitHub OAuth + email/password auth + /auth/me + logout"
```

---

## Task 6: Server — Doc Routes (CRUD + Upload + List)

**Files:**
- Create: `packages/server/src/routes/docs.ts`
- Create: `packages/server/src/docs.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/docs.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { app } from "./app.js";

describe("Doc routes", () => {
  it("rejects unauthenticated upload", async () => {
    const res = await app.request("/api/docs", { method: "POST", body: JSON.stringify({ content: "# Hello" }) });
    assert.equal(res.status, 401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes baseline**

Run: `cd packages/server && JWT_SECRET=test-secret DATABASE_URL=postgresql://localhost/mpipe node --import tsx --test src/docs.test.ts`
Expected: PASS (401 from auth middleware — baseline test)

- [ ] **Step 3: Create packages/server/src/routes/docs.ts**

```typescript
import { Hono } from "hono";
import { eq, and, ilike, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@mpipe/shared/db";
import { docs, readingPositions } from "@mpipe/shared/db/schema";
import { env } from "../env.js";

const docsRouter = new Hono();

// POST /api/docs — upload or update-in-place
docsRouter.post("/", async (c) => {
  const userId = c.get("user").sub;
  const body = await c.req.json<{ content: string; file_path?: string; is_public?: boolean }>();

  if (!body.content) return c.json({ error: "content is required" }, 400);
  if (body.content.length > 1_000_000) return c.json({ error: "content exceeds 1MB limit" }, 413);

  const title = body.content.match(/^#\s+(.+)$/m)?.[1] ?? "Untitled";

  // Update-in-place: same user + same file_path
  if (body.file_path) {
    const existing = await db.select().from(docs)
      .where(and(eq(docs.userId, userId), eq(docs.filePath, body.file_path)))
      .limit(1);

    if (existing.length > 0) {
      const doc = existing[0];
      await db.update(docs).set({
        content: body.content,
        title,
        version: doc.version + 1,
        isPublic: body.is_public ?? doc.isPublic,
        updatedAt: new Date(),
      }).where(eq(docs.id, doc.id));

      return c.json({
        slug: doc.slug,
        url: `${env.WEB_URL}/d/${doc.slug}`,
        is_new: false,
      });
    }
  }

  // Create new doc
  const slug = nanoid(10);
  await db.insert(docs).values({
    userId,
    slug,
    filePath: body.file_path ?? null,
    title,
    content: body.content,
    isPublic: body.is_public ?? false,
  });

  return c.json({
    slug,
    url: `${env.WEB_URL}/d/${slug}`,
    is_new: true,
  }, 201);
});

// GET /api/docs — list user's docs with filters
docsRouter.get("/", async (c) => {
  const userId = c.get("user").sub;
  const q = c.req.query("q");
  const readState = c.req.query("read_state");
  const visibility = c.req.query("visibility");

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
  if (readState === "not_started") filtered = userDocs.filter((d) => d.readPct === null || d.readPct === 0);
  if (readState === "reading") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct > 0 && d.readPct < 1);
  if (readState === "finished") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct >= 1);

  return c.json(filtered.map((d) => ({
    slug: d.slug,
    title: d.title,
    version: d.version,
    is_public: d.isPublic,
    updated_at: d.updatedAt.toISOString(),
    read_pct: d.readPct,
  })));
});

// GET /api/docs/:slug — get single doc
docsRouter.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const doc = await db.select().from(docs).where(eq(docs.slug, slug)).limit(1);

  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const d = doc[0];

  // Public docs are readable by anyone
  if (!d.isPublic) {
    const user = c.get("user");
    if (!user || user.sub !== d.userId) return c.json({ error: "not found" }, 404);
  }

  return c.json({
    slug: d.slug,
    title: d.title,
    content: d.content,
    version: d.version,
    is_public: d.isPublic,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  });
});

// PUT /api/docs/:slug — update content by slug
docsRouter.put("/:slug", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");
  const body = await c.req.json<{ content: string }>();

  const doc = await db.select().from(docs)
    .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
    .limit(1);

  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const title = body.content.match(/^#\s+(.+)$/m)?.[1] ?? doc[0].title;

  await db.update(docs).set({
    content: body.content,
    title,
    version: doc[0].version + 1,
    updatedAt: new Date(),
  }).where(eq(docs.id, doc[0].id));

  return c.json({
    slug,
    url: `${env.WEB_URL}/d/${slug}`,
    version: doc[0].version + 1,
  });
});

// PATCH /api/docs/:slug — update metadata
docsRouter.patch("/:slug", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");
  const body = await c.req.json<{ is_public?: boolean; title?: string }>();

  const doc = await db.select().from(docs)
    .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
    .limit(1);

  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const updates: Record<string, unknown> = {};
  if (body.is_public !== undefined) updates.isPublic = body.is_public;
  if (body.title !== undefined) updates.title = body.title;

  if (Object.keys(updates).length > 0) {
    await db.update(docs).set(updates).where(eq(docs.id, doc[0].id));
  }

  return c.json({ ok: true });
});

// DELETE /api/docs/:slug
docsRouter.delete("/:slug", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");

  const result = await db.delete(docs)
    .where(and(eq(docs.slug, slug), eq(docs.userId, userId)));

  return c.json({ ok: true });
});

export { docsRouter };
```

- [ ] **Step 4: Wire into app.ts**

Update `packages/server/src/app.ts`:

```typescript
import { docsRouter } from "./routes/docs.js";

// after app.use("/api/*", authMiddleware):
app.route("/api/docs", docsRouter);
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/docs.ts packages/server/src/docs.test.ts packages/server/src/app.ts
git commit -m "feat: doc CRUD routes with upload, update-in-place, list + filters"
```

---

## Task 7: Server — Reading Position + Push Subscription Routes

**Files:**
- Create: `packages/server/src/routes/position.ts`, `packages/server/src/routes/push.ts`
- Create: `packages/server/src/services/push.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create packages/server/src/routes/position.ts**

```typescript
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { docs, readingPositions } from "@mpipe/shared/db/schema";

const positionRouter = new Hono();

positionRouter.put("/:slug/position", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");
  const body = await c.req.json<{ scroll_pct: number; heading_id?: string }>();

  const doc = await db.select().from(docs).where(eq(docs.slug, slug)).limit(1);
  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const existing = await db.select().from(readingPositions)
    .where(and(eq(readingPositions.userId, userId), eq(readingPositions.docId, doc[0].id)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(readingPositions).set({
      scrollPct: body.scroll_pct,
      headingId: body.heading_id ?? null,
      updatedAt: new Date(),
    }).where(eq(readingPositions.id, existing[0].id));
  } else {
    await db.insert(readingPositions).values({
      userId,
      docId: doc[0].id,
      scrollPct: body.scroll_pct,
      headingId: body.heading_id ?? null,
    });
  }

  return c.json({ ok: true });
});

positionRouter.get("/:slug/position", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");

  const doc = await db.select().from(docs).where(eq(docs.slug, slug)).limit(1);
  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const pos = await db.select().from(readingPositions)
    .where(and(eq(readingPositions.userId, userId), eq(readingPositions.docId, doc[0].id)))
    .limit(1);

  if (pos.length === 0) return c.json({ scroll_pct: 0, heading_id: null });

  return c.json({ scroll_pct: pos[0].scrollPct, heading_id: pos[0].headingId });
});

export { positionRouter };
```

- [ ] **Step 2: Create packages/server/src/routes/push.ts**

```typescript
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { pushSubscriptions } from "@mpipe/shared/db/schema";

const pushRouter = new Hono();

pushRouter.post("/subscribe", async (c) => {
  const userId = c.get("user").sub;
  const body = await c.req.json<{ endpoint: string; p256dh: string; auth: string }>();

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return c.json({ error: "endpoint, p256dh, and auth are required" }, 400);
  }

  const existing = await db.select().from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, body.endpoint)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(pushSubscriptions).values({
      userId, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth,
    });
  }

  return c.json({ ok: true });
});

pushRouter.delete("/subscribe", async (c) => {
  const userId = c.get("user").sub;
  const body = await c.req.json<{ endpoint: string }>();

  await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, body.endpoint)));

  return c.json({ ok: true });
});

export { pushRouter };
```

- [ ] **Step 3: Create packages/server/src/services/push.ts**

```typescript
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { pushSubscriptions } from "@mpipe/shared/db/schema";
import { env } from "../env.js";

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(env.VAPID_EMAIL, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

export async function notifyDocUpdated(docId: string, title: string, version: number) {
  const subs = await db.select().from(pushSubscriptions);

  const payload = JSON.stringify({
    title: "Document Updated",
    body: `${title} was updated (v${version})`,
    url: `/d/${docId}`,
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
    } catch {
      // Remove stale subscriptions
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    }
  }
}
```

- [ ] **Step 4: Wire into app.ts**

Update `packages/server/src/app.ts`:

```typescript
import { positionRouter } from "./routes/position.js";
import { pushRouter } from "./routes/push.js";

app.route("/api/docs", positionRouter);
app.route("/api/push", pushRouter);
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/position.ts packages/server/src/routes/push.ts packages/server/src/services/push.ts packages/server/src/app.ts
git commit -m "feat: reading position + push subscription routes"
```

---

## Task 8: Server — Rate Limiting Middleware

**Files:**
- Create: `packages/server/src/middleware/rate-limit.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create packages/server/src/middleware/rate-limit.ts**

```typescript
import type { Context, Next } from "hono";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyFn: (c: Context) => string;
}

const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();

export function rateLimit(name: string, config: RateLimitConfig) {
  stores.set(name, new Map());

  return async (c: Context, next: Next) => {
    const store = stores.get(name)!;
    const key = config.keyFn(c);
    const now = Date.now();

    const entry = store.get(key);
    if (entry && entry.resetAt > now) {
      if (entry.count >= config.max) {
        return c.json({ error: "rate limit exceeded" }, 429);
      }
      entry.count++;
    } else {
      store.set(key, { count: 1, resetAt: now + config.windowMs });
    }

    // Cleanup expired entries periodically
    if (store.size > 10000) {
      for (const [k, v] of store) {
        if (v.resetAt <= now) store.delete(k);
      }
    }

    return next();
  };
}

export const authRateLimit = rateLimit("auth", {
  windowMs: 60_000,
  max: 10,
  keyFn: (c) => c.req.header("x-forwarded-for") ?? "unknown",
});

export const uploadRateLimit = rateLimit("upload", {
  windowMs: 3_600_000,
  max: 60,
  keyFn: (c) => c.get("user")?.sub ?? "anon",
});

export const apiRateLimit = rateLimit("api", {
  windowMs: 60_000,
  max: 300,
  keyFn: (c) => c.get("user")?.sub ?? c.req.header("x-forwarded-for") ?? "unknown",
});
```

- [ ] **Step 2: Wire into app.ts**

Update `packages/server/src/app.ts`:

```typescript
import { authRateLimit, apiRateLimit, uploadRateLimit } from "./middleware/rate-limit.js";

// Before auth routes:
app.use("/auth/*", authRateLimit);

// Before API routes (after authMiddleware):
app.use("/api/*", apiRateLimit);

// Upload-specific (applied in docs router or as route-level middleware)
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/middleware/rate-limit.ts packages/server/src/app.ts
git commit -m "feat: in-memory rate limiting middleware"
```

---

## Task 9: Docker Compose + Local Dev

**Files:**
- Create: `docker/docker-compose.yml`, `docker/Dockerfile.server`, `docker/Dockerfile.web-dev`

- [ ] **Step 1: Create docker/docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:17
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: mpipe
      POSTGRES_USER: mpipe
      POSTGRES_PASSWORD: mpipe
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ../drizzle:/docker-entrypoint-initdb.d:ro
    networks:
      - mpipe

  server:
    build:
      context: ..
      dockerfile: docker/Dockerfile.server
    ports:
      - "3001:3001"
    environment:
      PORT: "3001"
      DATABASE_URL: "postgresql://mpipe:mpipe@postgres:5432/mpipe"
      JWT_SECRET: "dev-secret-change-in-production"
      PUBLIC_URL: "http://localhost:3001"
      WEB_URL: "http://localhost:5173"
      GOOGLE_CLIENT_ID: ""
      GOOGLE_CLIENT_SECRET: ""
      GITHUB_CLIENT_ID: ""
      GITHUB_CLIENT_SECRET: ""
    depends_on:
      - postgres
    networks:
      - mpipe

  web:
    build:
      context: ..
      dockerfile: docker/Dockerfile.web-dev
    ports:
      - "5173:5173"
    volumes:
      - ../packages/web/src:/app/packages/web/src
      - ../packages/web/public:/app/packages/web/public
      - ../packages/web/index.html:/app/packages/web/index.html
      - ../packages/web/vite.config.ts:/app/packages/web/vite.config.ts
    environment:
      API_PROXY_TARGET: "http://server:3001"
    depends_on:
      - server
    networks:
      - mpipe

volumes:
  pgdata:

networks:
  mpipe:
```

- [ ] **Step 2: Create docker/Dockerfile.server**

```dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN yarn install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY tsconfig.base.json ./
RUN yarn workspace @mpipe/shared run build && yarn workspace @mpipe/server run build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Create docker/Dockerfile.web-dev**

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN yarn install
COPY packages/shared packages/shared
COPY packages/web packages/web
COPY tsconfig.base.json ./
RUN yarn workspace @mpipe/shared run build
WORKDIR /app/packages/web
CMD ["yarn", "dev", "--host", "0.0.0.0"]
```

- [ ] **Step 4: Test docker compose up**

Run: `cd docker && docker compose up --build`
Expected: Postgres starts, migrations run, server starts on 3001, web starts on 5173

- [ ] **Step 5: Commit**

```bash
git add docker/
git commit -m "feat: docker-compose for local dev (postgres + server + web)"
```

---

## Task 10: Web — Vite + React + Tailwind Scaffold

**Files:**
- Create: `packages/web/package.json`, `packages/web/tsconfig.json`, `packages/web/vite.config.ts`, `packages/web/index.html`
- Create: `packages/web/src/main.tsx`, `packages/web/src/index.css`, `packages/web/src/App.tsx`
- Create: `packages/web/src/lib/api.ts`, `packages/web/src/lib/auth.tsx`
- Create: `packages/web/src/pages/LoginPage.tsx`, `packages/web/src/pages/AuthCallbackPage.tsx`, `packages/web/src/pages/NotFoundPage.tsx`

- [ ] **Step 1: Create packages/web/package.json**

```json
{
  "name": "web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.1",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "remark-math": "^6.0.0",
    "rehype-highlight": "^7.0.2",
    "rehype-katex": "^7.0.1",
    "rehype-slug": "^6.0.0",
    "rehype-autolink-headings": "^7.1.0",
    "mermaid": "^11.6.0",
    "katex": "^0.16.21"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.0",
    "@tailwindcss/vite": "^4.2.1",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.9.3",
    "vite": "^8.0.0"
  }
}
```

- [ ] **Step 2: Create packages/web/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: process.env.API_PROXY_TARGET ?? "http://localhost:3001", changeOrigin: true },
      "/auth": { target: process.env.API_PROXY_TARGET ?? "http://localhost:3001", changeOrigin: true },
    },
  },
});
```

- [ ] **Step 3: Create packages/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create packages/web/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>mpipe</title>
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#1a1a2e" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create packages/web/src/index.css**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

- [ ] **Step 6: Create packages/web/src/lib/api.ts**

```typescript
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 7: Create packages/web/src/lib/auth.tsx**

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api.js";

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  };

  return <AuthContext value={{ user, loading, logout }}>{children}</AuthContext>;
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 8: Create packages/web/src/App.tsx**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DocPage } from "./pages/DocPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/d/:slug" element={<DocPage />} />
          <Route path="/" element={<ProtectedRoute><Navigate to="/d/latest" replace /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 9: Create pages (LoginPage, NotFoundPage) — minimal stubs**

`packages/web/src/pages/LoginPage.tsx`:

```typescript
import { useAuth } from "../lib/auth.js";
import { Navigate } from "react-router-dom";

export function LoginPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <div className="w-full max-w-sm space-y-6 p-8">
        <h1 className="text-2xl font-bold text-center">Sign in to mpipe</h1>
        <div className="space-y-3">
          <a href="/auth/google" className="block w-full text-center py-2.5 px-4 rounded-lg bg-white text-gray-900 font-medium hover:bg-gray-100 transition">
            Continue with Google
          </a>
          <a href="/auth/github" className="block w-full text-center py-2.5 px-4 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 transition">
            Continue with GitHub
          </a>
        </div>
        <div className="flex items-center gap-3 text-gray-500 text-sm">
          <div className="flex-1 h-px bg-gray-800" /><span>or</span><div className="flex-1 h-px bg-gray-800" />
        </div>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const res = await fetch("/auth/email/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
          });
          if (res.ok) window.location.href = "/";
        }}>
          <input name="email" type="email" placeholder="Email" required className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500" />
          <input name="password" type="password" placeholder="Password" required className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500" />
          <button type="submit" className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition">Sign in</button>
        </form>
      </div>
    </div>
  );
}
```

`packages/web/src/pages/NotFoundPage.tsx`:

```typescript
export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-gray-400">Document not found</p>
      </div>
    </div>
  );
}
```

`packages/web/src/pages/DocPage.tsx` (stub for now — fleshed out in Task 11):

```typescript
export function DocPage() {
  return <div className="min-h-screen bg-gray-950 text-gray-100 p-8">Doc viewer coming next...</div>;
}
```

- [ ] **Step 10: Create packages/web/src/main.tsx**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 11: Install and verify**

Run: `yarn install && yarn dev:web`
Expected: Vite starts on port 5173, login page renders

- [ ] **Step 12: Commit**

```bash
git add packages/web/
git commit -m "feat: web scaffold — Vite + React 19 + Tailwind v4 + auth + login page"
```

---

## Task 11: Web — Markdown Reader (DocPage)

**Files:**
- Create: `packages/web/src/components/MarkdownRenderer.tsx`
- Create: `packages/web/src/components/Header.tsx`
- Create: `packages/web/src/components/ReadingProgress.tsx`
- Modify: `packages/web/src/pages/DocPage.tsx`

- [ ] **Step 1: Create packages/web/src/components/MarkdownRenderer.tsx**

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [code]);

  return <div ref={ref} className="my-4 flex justify-center" />;
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <article className="prose prose-invert prose-gray max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex, rehypeSlug, rehypeAutolinkHeadings]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-mermaid/.exec(className ?? "");
            if (match) return <MermaidBlock code={String(children).trim()} />;
            return <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
```

- [ ] **Step 2: Create packages/web/src/components/ReadingProgress.tsx**

```typescript
import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const scrollTop = document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-1 bg-gray-800 z-50">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-[width] duration-150"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create packages/web/src/components/Header.tsx**

```typescript
import { useAuth } from "../lib/auth.js";
import { useState } from "react";

interface HeaderProps {
  onToggleTOC: () => void;
  onToggleSearch: () => void;
}

export function Header({ onToggleTOC, onToggleSearch }: HeaderProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 bg-gray-950/80 backdrop-blur border-b border-gray-800">
      <button onClick={onToggleTOC} className="px-2 py-1 rounded text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition">
        &#9776; TOC
      </button>
      <div className="flex items-center gap-2">
        <button onClick={onToggleSearch} className="px-2 py-1 rounded text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition">
          &#x1F50D;
        </button>
        <kbd className="hidden sm:inline text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">&#x2318;K</kbd>
        {user && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
              {user.avatar_url ? <img src={user.avatar_url} className="w-7 h-7 rounded-full" /> : user.name[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-2 text-sm text-gray-400 border-b border-gray-800">{user.email}</div>
                <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition">
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Implement DocPage**

Replace `packages/web/src/pages/DocPage.tsx`:

```typescript
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Header } from "../components/Header.js";
import { MarkdownRenderer } from "../components/MarkdownRenderer.js";
import { ReadingProgress } from "../components/ReadingProgress.js";
import type { DocResponse } from "@mpipe/shared";

export function DocPage() {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<DocResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api<DocResponse>(`/api/docs/${slug}`)
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <p className="text-gray-400">{error === "not found" ? "Document not found" : error}</p>
    </div>
  );

  if (!doc) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header onToggleTOC={() => setTocOpen(!tocOpen)} onToggleSearch={() => setSearchOpen(!searchOpen)} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        <p className="text-sm text-gray-500 mb-8">v{doc.version} &middot; {new Date(doc.updated_at).toLocaleDateString()}</p>
        <MarkdownRenderer content={doc.content} />
      </main>
      <ReadingProgress />
    </div>
  );
}
```

- [ ] **Step 5: Verify — start dev server and open a doc**

Run: `yarn dev:web` (with server running)
Expected: Navigating to `/d/{slug}` renders the markdown document

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/ packages/web/src/pages/DocPage.tsx
git commit -m "feat: markdown reader — DocPage with syntax highlighting, math, mermaid, progress bar"
```

---

## Task 12: Web — TOC Sidebar + Search Panel + Keyboard Shortcut

**Files:**
- Create: `packages/web/src/components/TOCSidebar.tsx`, `packages/web/src/components/SearchPanel.tsx`, `packages/web/src/components/DocListItem.tsx`, `packages/web/src/components/CycleFilter.tsx`
- Create: `packages/web/src/hooks/useKeyboard.ts`
- Modify: `packages/web/src/pages/DocPage.tsx`

- [ ] **Step 1: Create packages/web/src/components/TOCSidebar.tsx**

```typescript
import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TOCSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    const elements = document.querySelectorAll("article h1, article h2, article h3, article h4");
    setHeadings(Array.from(elements).map((el) => ({
      id: el.id,
      text: el.textContent ?? "",
      level: parseInt(el.tagName[1]),
    })));
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 z-50 overflow-y-auto p-4 pt-16">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Contents</h2>
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            onClick={onClose}
            className="block py-1 text-sm text-gray-300 hover:text-white transition"
            style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Create packages/web/src/components/CycleFilter.tsx**

```typescript
interface CycleFilterProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function CycleFilter({ options, value, onChange }: CycleFilterProps) {
  const idx = options.indexOf(value);
  const next = options[(idx + 1) % options.length];

  return (
    <button
      onClick={() => onChange(next)}
      className={`px-2 py-1 rounded text-xs font-medium transition ${
        value === options[0]
          ? "bg-gray-800 text-gray-400"
          : "bg-indigo-900/50 text-indigo-300 border border-indigo-800"
      }`}
    >
      {value} &#x21bb;
    </button>
  );
}
```

- [ ] **Step 3: Create packages/web/src/components/DocListItem.tsx**

```typescript
import { Link } from "react-router-dom";
import type { DocListItem as DocItem } from "@mpipe/shared";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

export function DocListItem({ doc }: { doc: DocItem }) {
  const pct = doc.read_pct ?? 0;
  const pctColor = pct >= 1 ? "text-green-400" : pct > 0 ? "text-amber-400" : "text-gray-600";
  const barColor = pct >= 1 ? "bg-green-400" : pct > 0 ? "bg-amber-400" : "bg-gray-700";

  return (
    <Link to={`/d/${doc.slug}`} className="block p-3 rounded-lg bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition mb-2">
      <div className="font-medium text-sm text-gray-100 mb-1 truncate">{doc.title}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">v{doc.version} &middot; {timeAgo(doc.updated_at)}</span>
        <div className="flex items-center gap-2">
          <span className={pctColor}>{Math.round(pct * 100)}%</span>
          <div className="w-6 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct * 100}%` }} />
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${doc.is_public ? "bg-green-900/50 text-green-400" : "bg-indigo-900/50 text-indigo-400"}`}>
            {doc.is_public ? "pub" : "priv"}
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Create packages/web/src/components/SearchPanel.tsx**

```typescript
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { DocListItem } from "./DocListItem.js";
import { CycleFilter } from "./CycleFilter.js";
import type { DocListItem as DocItem } from "@mpipe/shared";

const READ_STATES = ["All", "Not started", "Reading", "Finished"];
const VISIBILITY = ["All", "Private", "Public"];

function readStateParam(v: string): string | undefined {
  if (v === "Not started") return "not_started";
  if (v === "Reading") return "reading";
  if (v === "Finished") return "finished";
  return undefined;
}

export function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [query, setQuery] = useState("");
  const [readState, setReadState] = useState("All");
  const [visibility, setVisibility] = useState("All");

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const rs = readStateParam(readState);
    if (rs) params.set("read_state", rs);
    if (visibility === "Private") params.set("visibility", "private");
    if (visibility === "Public") params.set("visibility", "public");

    api<DocItem[]>(`/api/docs?${params}`).then(setDocs).catch(() => {});
  }, [open, query, readState, visibility]);

  if (!open) return null;

  return (
    <>
      <div className="hidden md:block fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full md:w-96 bg-gray-900 border-l border-gray-800 z-50 flex flex-col">
        <div className="p-3 border-b border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Your Docs</h2>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300">&#x2715;</button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search docs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder-gray-500"
              autoFocus
            />
            <CycleFilter options={READ_STATES} value={readState} onChange={setReadState} />
            <CycleFilter options={VISIBILITY} value={visibility} onChange={setVisibility} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {docs.map((doc) => <DocListItem key={doc.slug} doc={doc} />)}
          {docs.length === 0 && <p className="text-sm text-gray-500 text-center mt-8">No docs found</p>}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Create packages/web/src/hooks/useKeyboard.ts**

```typescript
import { useEffect } from "react";

export function useKeyboard(key: string, metaKey: boolean, handler: () => void) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === key && (metaKey ? e.metaKey || e.ctrlKey : true)) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [key, metaKey, handler]);
}
```

- [ ] **Step 6: Wire TOC + Search + Cmd+K into DocPage**

Update `packages/web/src/pages/DocPage.tsx` — add imports and state:

```typescript
import { TOCSidebar } from "../components/TOCSidebar.js";
import { SearchPanel } from "../components/SearchPanel.js";
import { useKeyboard } from "../hooks/useKeyboard.js";
import { useCallback } from "react";

// Inside DocPage component, add:
const toggleSearch = useCallback(() => setSearchOpen((v) => !v), []);
useKeyboard("k", true, toggleSearch);

// In JSX, add after <Header>:
<TOCSidebar open={tocOpen} onClose={() => setTocOpen(false)} />
<SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
```

- [ ] **Step 7: Verify — open browser, Cmd+K should open search panel**

Run: `yarn dev:web`
Expected: Cmd+K opens right-side search panel, TOC button opens left sidebar

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/components/ packages/web/src/hooks/ packages/web/src/pages/DocPage.tsx
git commit -m "feat: TOC sidebar, search panel with filters, Cmd+K keyboard shortcut"
```

---

## Task 13: Web — Reading Position Tracking + Dark/Light Mode

**Files:**
- Create: `packages/web/src/hooks/useReadingPosition.ts`, `packages/web/src/hooks/useTheme.ts`
- Modify: `packages/web/src/pages/DocPage.tsx`, `packages/web/src/components/AvatarMenu.tsx`

- [ ] **Step 1: Create packages/web/src/hooks/useReadingPosition.ts**

```typescript
import { useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import type { PositionPayload } from "@mpipe/shared";

export function useReadingPosition(slug: string | undefined) {
  const restored = useRef(false);

  // Restore position on mount
  useEffect(() => {
    if (!slug || restored.current) return;
    api<PositionPayload>(`/api/docs/${slug}/position`).then((pos) => {
      if (pos.heading_id) {
        const el = document.getElementById(pos.heading_id);
        if (el) { el.scrollIntoView(); restored.current = true; return; }
      }
      if (pos.scroll_pct > 0) {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, scrollHeight * pos.scroll_pct);
      }
      restored.current = true;
    }).catch(() => {});
  }, [slug]);

  // Save position on scroll (debounced)
  useEffect(() => {
    if (!slug) return;
    let timeout: ReturnType<typeof setTimeout>;

    const handler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const scrollTop = document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPct = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

        // Find nearest heading above viewport
        const headings = document.querySelectorAll("article [id]");
        let headingId: string | undefined;
        for (const el of headings) {
          if (el.getBoundingClientRect().top <= 10) headingId = el.id;
        }

        api(`/api/docs/${slug}/position`, {
          method: "PUT",
          body: JSON.stringify({ scroll_pct: scrollPct, heading_id: headingId }),
        }).catch(() => {});
      }, 2500);
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => { window.removeEventListener("scroll", handler); clearTimeout(timeout); };
  }, [slug]);
}
```

- [ ] **Step 2: Create packages/web/src/hooks/useTheme.ts**

```typescript
import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("mpipe-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("mpipe-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
```

- [ ] **Step 3: Wire into DocPage**

Add to `packages/web/src/pages/DocPage.tsx`:

```typescript
import { useReadingPosition } from "../hooks/useReadingPosition.js";

// Inside DocPage:
useReadingPosition(slug);
```

- [ ] **Step 4: Add theme toggle to AvatarMenu in Header**

Update the avatar dropdown in `packages/web/src/components/Header.tsx` to accept and render a theme toggle:

```typescript
// Add to Header props:
interface HeaderProps {
  onToggleTOC: () => void;
  onToggleSearch: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

// In the dropdown menu:
<button onClick={onToggleTheme} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition">
  {theme === "dark" ? "Light mode" : "Dark mode"}
</button>
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/hooks/ packages/web/src/components/Header.tsx packages/web/src/pages/DocPage.tsx
git commit -m "feat: reading position tracking + light/dark mode toggle"
```

---

## Task 14: Web — PWA (Service Worker + Manifest + Push)

**Files:**
- Create: `packages/web/public/manifest.json`
- Create: `packages/web/src/sw.ts`, `packages/web/src/lib/push.ts`

- [ ] **Step 1: Create packages/web/public/manifest.json**

```json
{
  "name": "mpipe",
  "short_name": "mpipe",
  "description": "Pipe markdown to your browser",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create packages/web/src/sw.ts**

```typescript
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "mpipe-v1";
const SHELL_URLS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() as { title: string; body: string; url: string } | undefined;
  if (!data) return;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url: string }).url;
  event.waitUntil(self.clients.openWindow(url));
});
```

- [ ] **Step 3: Create packages/web/src/lib/push.ts**

```typescript
export async function subscribeToPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return;

  const vapidKey = await fetch("/api/push/vapid-key").then((r) => r.text()).catch(() => "");
  if (!vapidKey) return;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  });

  const json = subscription.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });
}
```

- [ ] **Step 4: Register service worker in main.tsx**

Add to `packages/web/src/main.tsx`:

```typescript
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/src/sw.ts", { type: "module" });
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/public/manifest.json packages/web/src/sw.ts packages/web/src/lib/push.ts packages/web/src/main.tsx
git commit -m "feat: PWA — service worker, manifest, push notification support"
```

---

## Task 15: Skill — /mpipe for Claude Code

**Files:**
- Create: `skills/mpipe/SKILL.md`

- [ ] **Step 1: Create skills/mpipe/SKILL.md**

````markdown
---
name: mpipe
description: Pipe markdown from your conversation to mpipe.dev for reading on any device. Use when the user says "/mpipe", wants to share a markdown file, or asks to send a doc to their phone/browser.
---

## Usage

```
/mpipe                        → share the last markdown block from this conversation
/mpipe ./path/to/file.md      → share a specific file
/mpipe --new ./file.md        → force new link (snapshot)
/mpipe --public ./file.md     → make the doc publicly shareable
```

## Behavior

1. **Determine content:**
   - If a file path is provided, read that file
   - If no path, extract the last significant markdown block from the conversation

2. **Upload via MCP:**
   Call the `mpipe_upload` MCP tool:
   ```json
   {
     "content": "<markdown content>",
     "file_path": "<original path or null>",
     "is_public": false
   }
   ```
   - If `--new` flag: omit `file_path` to force a new document
   - If `--public` flag: set `is_public: true`

3. **Return the link:**
   Print the URL returned by the tool. Example:
   ```
   ✓ Piped to https://mpipe.dev/d/a8f3k2x9
   ```

4. **Optional Slack share:**
   If Slack MCP tools are available (check for `slack_send_message`), ask:
   > "Want to share this on Slack? Which channel?"
   If yes, call `slack_send_message` with the URL.
````

- [ ] **Step 2: Commit**

```bash
git add skills/
git commit -m "feat: /mpipe skill for Claude Code"
```

---

## Task 16: Docker + kdep Deployment Config

**Files:**
- Create: `kdep/web/app.yml`, `kdep/web/secrets.yml`, `kdep/web/state.yml`
- Create: `kdep/postgres/app.yml`, `kdep/postgres/secrets.yml`, `kdep/postgres/state.yml`

- [ ] **Step 1: Create kdep/web/app.yml**

```yaml
preset: web
namespace: mpipe
name: mpipe-web
image: mpipe-web
registry: leadfycr.azurecr.io
tag: "0.1"
dockerfile: docker/Dockerfile.server
port: 3001
replicas: 1
image_pull_secrets: ns-mpipe-azcr-secret
ingress_class_field: nginx
probe:
  path: /health
  port: 3001
  initial_delay: 10
  period: 15
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 5"]
env_from:
  - configmap/config-mpipe-web
  - secret/secret-mpipe-web
env:
  PORT: "3001"
  DATABASE_URL: ""
  JWT_SECRET: ""
  GOOGLE_CLIENT_ID: ""
  GOOGLE_CLIENT_SECRET: ""
  GITHUB_CLIENT_ID: ""
  GITHUB_CLIENT_SECRET: ""
  PUBLIC_URL: "https://mpipe.dev"
  WEB_URL: "https://mpipe.dev"
  VAPID_PUBLIC_KEY: ""
  VAPID_PRIVATE_KEY: ""
  VAPID_EMAIL: "mailto:admin@mpipe.dev"
domains:
  - mpipe.dev
ingress_annotations:
  cert-manager.io/cluster-issuer: letsencrypt
  nginx.ingress.kubernetes.io/proxy-body-size: "2m"
```

- [ ] **Step 2: Create kdep/web/secrets.yml and state.yml**

`kdep/web/secrets.yml`:
```yaml
DATABASE_URL: ""
JWT_SECRET: ""
GOOGLE_CLIENT_ID: ""
GOOGLE_CLIENT_SECRET: ""
GITHUB_CLIENT_ID: ""
GITHUB_CLIENT_SECRET: ""
VAPID_PUBLIC_KEY: ""
VAPID_PRIVATE_KEY: ""
```

`kdep/web/state.yml`:
```yaml
tag: "0.1"
replicas: 1
```

- [ ] **Step 3: Create kdep/postgres/app.yml**

```yaml
preset: stateful
namespace: mpipe
name: mpipe-postgres
image: postgres
registry: docker.io/library
tag: "17"
port: 5432
replicas: 1
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
env_from:
  - secret/secret-mpipe-postgres
env:
  POSTGRES_DB: mpipe
  POSTGRES_USER: mpipe
  POSTGRES_PASSWORD: ""
volumes:
  - name: pgdata
    mountPath: /var/lib/postgresql/data
    size: 10Gi
    storageClass: managed-premium
```

- [ ] **Step 4: Create kdep/postgres/secrets.yml and state.yml**

`kdep/postgres/secrets.yml`:
```yaml
POSTGRES_PASSWORD: ""
```

`kdep/postgres/state.yml`:
```yaml
tag: "17"
replicas: 1
```

- [ ] **Step 5: Commit**

```bash
git add kdep/
git commit -m "feat: kdep deployment config for web + postgres"
```

---

## Task 17: Production Dockerfile (Server Serves Static PWA)

**Files:**
- Modify: `docker/Dockerfile.server`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Update Dockerfile.server to include built web assets**

Replace `docker/Dockerfile.server`:

```dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN yarn install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/web packages/web
COPY tsconfig.base.json ./
RUN yarn workspace @mpipe/shared run build \
 && yarn workspace @mpipe/server run build \
 && yarn workspace web run build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/web/dist ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Serve static files from Hono**

Add to `packages/server/src/app.ts`, after all API routes:

```typescript
import { serveStatic } from "@hono/node-server/serve-static";
import path from "node:path";

// Serve built web assets (production only)
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./public" }));
  // SPA fallback — serve index.html for all non-API routes
  app.get("*", serveStatic({ root: "./public", path: "index.html" }));
}
```

- [ ] **Step 3: Commit**

```bash
git add docker/Dockerfile.server packages/server/src/app.ts
git commit -m "feat: production Docker image — server serves static PWA assets"
```

---

## Summary

| Task | What it builds | Depends on |
|------|---------------|------------|
| 1 | Monorepo + shared (schema, types) | — |
| 2 | Hono server shell + health | 1 |
| 3 | JWT auth middleware | 2 |
| 4 | Google OAuth | 3 |
| 5 | GitHub OAuth + email/pass | 3 |
| 6 | Doc CRUD routes | 3 |
| 7 | Reading position + push routes | 6 |
| 8 | Rate limiting | 2 |
| 9 | Docker Compose (local dev) | 2 |
| 10 | Web scaffold (Vite + React + auth) | 2 |
| 11 | Markdown reader (DocPage) | 10, 6 |
| 12 | TOC + Search panel + Cmd+K | 11 |
| 13 | Reading position tracking + theme | 12, 7 |
| 14 | PWA (service worker, push) | 13 |
| 15 | /mpipe skill | 6 |
| 16 | kdep deployment config | 9 |
| 17 | Production Dockerfile | 10, 2 |

## Deferred (post-v1)

These spec requirements are intentionally deferred until the core is working:

- **MCP OAuth server** (`/mcp/authorize`, `/mcp/token`) — depends on MCP SDK which is still evolving across editors. Build after core API + web are stable.
- **`npx mpipe` CLI** — onboarding tool that detects editor environment and configures MCP + installs skills. Requires knowing exact config paths for each editor (CC, Cursor, VSCode, Codex, OpenCode). Build after the skill and MCP server are proven.
- **Email password reset** (`/auth/email/reset`) — needs an email sending service. Add when user base warrants it.
- **Push notification triggers from doc update** — the `notifyDocUpdated` service function exists in Task 7 but is not wired into the doc update flow. Wire it into `POST /api/docs` and `PUT /api/docs/:slug` after push subscriptions are tested end-to-end.
