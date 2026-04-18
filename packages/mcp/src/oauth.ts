import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import * as jose from "jose";
import { eq } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { users } from "@pipeit/shared/db/schema";
import { verifyJwt } from "@pipeit/shared/jwt";

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
  const base = process.env.PUBLIC_URL || new URL(c.req.url).origin;
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

// Dynamic client registration (RFC 7591) — required by MCP SDK
// Accepts any client and returns a client_id. We don't enforce client secrets
// since we rely on PKCE for security (public clients).
oauthApp.post("/register", async (c) => {
  const body = await c.req.json<{
    client_name?: string;
    redirect_uris?: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
  }>();

  const clientId = nanoid(21);
  return c.json({
    client_id: clientId,
    client_name: body.client_name ?? "MCP Client",
    redirect_uris: body.redirect_uris ?? [],
    grant_types: body.grant_types ?? ["authorization_code"],
    response_types: body.response_types ?? ["code"],
    token_endpoint_auth_method: body.token_endpoint_auth_method ?? "none",
  }, 201);
});

// Authorization endpoint — routes the user into the SPA consent flow.
// MCP client redirects here with: client_id, redirect_uri, state, code_challenge, code_challenge_method
oauthApp.get("/authorize", async (c) => {
  const clientId = c.req.query("client_id") ?? "";
  const redirectUri = c.req.query("redirect_uri") ?? "";
  const state = c.req.query("state") ?? "";
  const codeChallenge = c.req.query("code_challenge") ?? "";
  const codeChallengeMethod = c.req.query("code_challenge_method") ?? "S256";

  if (!redirectUri || !codeChallenge) {
    return c.json({ error: "missing redirect_uri or code_challenge" }, 400);
  }

  const oauthState = JSON.stringify({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod, issuedAt: Date.now() });
  setCookie(c, "mcp_oauth_state", oauthState, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  // Authed users go straight to the SPA consent page. Unauthed users detour to
  // /login?return_to=/mcp/consent — LoginPage will forward back after sign-in.
  const sessionToken = getCookie(c, "token");
  if (sessionToken) {
    return c.redirect("/mcp/consent");
  }
  return c.redirect("/login?return_to=/mcp/consent");
});

// Returns the pending OAuth request metadata so the SPA can render the consent UI.
oauthApp.get("/consent-info", (c) => {
  const cookie = getCookie(c, "mcp_oauth_state");
  if (!cookie) return c.json({ error: "no pending authorization" }, 404);
  let parsed: { clientId: string; issuedAt: number };
  try {
    parsed = JSON.parse(cookie);
  } catch {
    return c.json({ error: "invalid state" }, 400);
  }
  return c.json({
    client_id: parsed.clientId,
    client_name: "Claude Code",
    issued_at: parsed.issuedAt,
  });
});

// The SPA consent page POSTs { action: "allow" | "deny" } with the session cookie.
// On allow: mint a code, delete the oauth_state cookie, return { redirect: url-with-code }.
// On deny: delete the cookie and return { redirect: url-with-error }.
oauthApp.post("/consent", async (c) => {
  const body = await c.req.json<{ action?: string }>();
  const action = body?.action;
  const oauthStateCookie = getCookie(c, "mcp_oauth_state");
  if (!oauthStateCookie) return c.json({ error: "no pending authorization" }, 400);

  let redirectUri: string;
  let state: string;
  let codeChallenge: string;
  try {
    ({ redirectUri, state, codeChallenge } = JSON.parse(oauthStateCookie));
  } catch {
    setCookie(c, "mcp_oauth_state", "", { maxAge: 0, path: "/" });
    return c.json({ error: "invalid state" }, 400);
  }

  if (action === "deny") {
    setCookie(c, "mcp_oauth_state", "", { maxAge: 0, path: "/" });
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    return c.json({ redirect: url.toString() });
  }

  if (action !== "allow") {
    return c.json({ error: "invalid action" }, 400);
  }

  const sessionToken = getCookie(c, "token");
  if (!sessionToken) return c.json({ error: "not authenticated" }, 401);

  const payload = await verifyJwt(sessionToken);
  const userId = payload.sub;

  const code = nanoid(32);
  authCodes.set(code, {
    userId,
    redirectUri,
    codeChallenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  setCookie(c, "mcp_oauth_state", "", { maxAge: 0, path: "/" });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return c.json({ redirect: url.toString() });
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
