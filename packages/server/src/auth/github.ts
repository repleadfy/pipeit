import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { users, authIdentities } from "@pipeit/shared/db/schema";
import { signJwt } from "./jwt.js";
import { env } from "../env.js";

const github = new Hono();

github.get("/github", (c) => {
  const returnTo = c.req.query("return_to");
  if (returnTo && /^\/(?![/\\])/.test(returnTo)) {
    setCookie(c, "return_to", returnTo, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 600,
      path: "/",
      secure: env.PUBLIC_URL.startsWith("https"),
    });
  } else {
    // Always clear a stale cookie when no valid return_to is provided — prevents
    // a 10-minute-old cookie from hijacking a fresh OAuth flow.
    setCookie(c, "return_to", "", { maxAge: 0, path: "/" });
  }
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

  // Check if this is an MCP OAuth flow
  const mcpOauthState = getCookie(c, "mcp_oauth_state");
  if (mcpOauthState) {
    return c.redirect(`${env.PUBLIC_URL}/mcp/consent`);
  }

  const returnToCookie = getCookie(c, "return_to");
  if (returnToCookie && /^\/(?![/\\])/.test(returnToCookie)) {
    setCookie(c, "return_to", "", { maxAge: 0, path: "/" });
    return c.redirect(`${env.WEB_URL}${returnToCookie}`);
  }
  setCookie(c, "return_to", "", { maxAge: 0, path: "/" });
  return c.redirect(env.WEB_URL);
});

export { github };
