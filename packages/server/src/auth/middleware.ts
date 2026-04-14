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
