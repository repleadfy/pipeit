import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { pushSubscriptions } from "@mpipe/shared/db/schema";

const pushRouter = new Hono();

pushRouter.post("/subscribe", async (c) => {
  const userId = c.get("user").sub;
  const body = await c.req.json<{ endpoint: string; p256dh: string; auth: string }>();

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return c.json({ error: "endpoint, p256dh, and auth are required" }, 400);
  }

  const existing = await db.select().from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, body.endpoint)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(pushSubscriptions).values({
      userId, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth,
    });
  }

  return c.json({ ok: true });
});

pushRouter.delete("/subscribe", async (c) => {
  const userId = c.get("user").sub;
  const body = await c.req.json<{ endpoint: string }>();

  await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, body.endpoint)));

  return c.json({ ok: true });
});

export { pushRouter };
