import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import * as jose from "jose";
import { eq } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { users } from "@mpipe/shared/db/schema";

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
<html><head><meta charset="utf-8"><title>mpipe — Sign In</title>
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
  <h1>mpipe</h1>
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
