import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db } from "@pipeit/shared/db";
import { users, authIdentities } from "@pipeit/shared/db/schema";
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

  // MCP flow: client reads `redirect` and navigates. Non-MCP flow: client
  // handles its own `return_to` from the URL — server never sees it here.
  const mcpOauthState = getCookie(c, "mcp_oauth_state");
  if (mcpOauthState) {
    return c.json({ redirect: "/mcp/consent" });
  }

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

  // MCP flow: client reads `redirect` and navigates. Non-MCP flow: client
  // handles its own `return_to` from the URL — server never sees it here.
  const mcpOauthState = getCookie(c, "mcp_oauth_state");
  if (mcpOauthState) {
    return c.json({ redirect: "/mcp/consent" });
  }

  return c.json({ id: user.id, email: user.email, name: user.name });
});

export { email };
