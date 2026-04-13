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
