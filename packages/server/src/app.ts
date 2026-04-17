import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { users } from "@mpipe/shared/db/schema";
import { env } from "./env.js";
import { google } from "./auth/google.js";
import { github } from "./auth/github.js";
import { email } from "./auth/email.js";
import { verifyJwt } from "./auth/jwt.js";
import { authMiddleware } from "./auth/middleware.js";
import { authRateLimit, apiRateLimit } from "./middleware/rate-limit.js";
import { docsRouter } from "./routes/docs.js";
import { positionRouter } from "./routes/position.js";
import { pushRouter } from "./routes/push.js";
import { mcpApp } from "@mpipe/mcp";

const app = new Hono();

app.use("*", cors({
  origin: [env.WEB_URL, env.PUBLIC_URL],
  credentials: true,
}));

app.get("/health", (c) => c.json({ status: "ok" }));

app.use("/auth/*", authRateLimit);

app.route("/auth", google);
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

app.use("/api/*", authMiddleware);
app.use("/api/*", apiRateLimit);

app.route("/api/docs", docsRouter);
app.route("/api/docs", positionRouter);
app.route("/api/push", pushRouter);

// MCP remote server
app.route("/mcp", mcpApp);

// OAuth metadata discovery
app.get("/.well-known/oauth-authorization-server", (c) => {
  const base = env.PUBLIC_URL || new URL(c.req.url).origin;
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/mcp/authorize`,
    token_endpoint: `${base}/mcp/token`,
    registration_endpoint: `${base}/mcp/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

// Serve built web assets (production only)
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./public" }));
  // SPA fallback — serve index.html only for non-file paths (no extension)
  app.get("*", (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (path.includes(".")) return c.notFound();
    return serveStatic({ root: "./public", path: "index.html" })(c, next);
  });
}

export { app };
