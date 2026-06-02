import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { type JwtPayload, verifyJwt } from "./jwt.js";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  // Allow public doc access: GET /api/docs/:slug and /api/docs/:slug/raw
  // (except "latest" which needs auth). Per-doc visibility is enforced in the handler.
  const path = new URL(c.req.url).pathname;
  if (c.req.method === "GET" && /^\/api\/docs\/[^/]+(\/raw)?$/.test(path) && !path.endsWith("/latest")) {
    const token = getCookie(c, "token") ?? c.req.header("Authorization")?.replace("Bearer ", "");
    if (token) {
      try {
        c.set("user", await verifyJwt(token));
      } catch {}
    }
    return next();
  }

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
