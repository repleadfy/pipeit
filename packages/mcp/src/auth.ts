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
