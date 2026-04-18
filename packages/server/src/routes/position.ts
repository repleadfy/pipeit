import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { docs, readingPositions } from "@pipeit/shared/db/schema";

const positionRouter = new Hono();

positionRouter.put("/:slug/position", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");
  const body = await c.req.json<{ scroll_pct: number; heading_id?: string }>();

  const doc = await db.select().from(docs).where(eq(docs.slug, slug)).limit(1);
  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const existing = await db.select().from(readingPositions)
    .where(and(eq(readingPositions.userId, userId), eq(readingPositions.docId, doc[0].id)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(readingPositions).set({
      scrollPct: body.scroll_pct,
      headingId: body.heading_id ?? null,
      updatedAt: new Date(),
    }).where(eq(readingPositions.id, existing[0].id));
  } else {
    await db.insert(readingPositions).values({
      userId,
      docId: doc[0].id,
      scrollPct: body.scroll_pct,
      headingId: body.heading_id ?? null,
    });
  }

  return c.json({ ok: true });
});

positionRouter.get("/:slug/position", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");

  const doc = await db.select().from(docs).where(eq(docs.slug, slug)).limit(1);
  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const pos = await db.select().from(readingPositions)
    .where(and(eq(readingPositions.userId, userId), eq(readingPositions.docId, doc[0].id)))
    .limit(1);

  if (pos.length === 0) return c.json({ scroll_pct: 0, heading_id: null });

  return c.json({ scroll_pct: pos[0].scrollPct, heading_id: pos[0].headingId });
});

export { positionRouter };
