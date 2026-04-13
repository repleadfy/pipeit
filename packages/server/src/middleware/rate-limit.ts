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
