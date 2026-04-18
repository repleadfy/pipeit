import { Hono } from "hono";
import { eq, and, ilike, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@pipeit/shared/db";
import { docs, readingPositions } from "@pipeit/shared/db/schema";
import { env } from "../env.js";

const docsRouter = new Hono();

// POST /api/docs — upload or update-in-place
docsRouter.post("/", async (c) => {
  const userId = c.get("user").sub;
  const body = await c.req.json<{ content: string; file_path?: string; is_public?: boolean }>();

  if (!body.content) return c.json({ error: "content is required" }, 400);
  if (body.content.length > 1_000_000) return c.json({ error: "content exceeds 1MB limit" }, 413);

  const title = body.content.match(/^#\s+(.+)$/m)?.[1] ?? "Untitled";

  // Update-in-place: same user + same file_path
  if (body.file_path) {
    const existing = await db.select().from(docs)
      .where(and(eq(docs.userId, userId), eq(docs.filePath, body.file_path)))
      .limit(1);

    if (existing.length > 0) {
      const doc = existing[0];
      await db.update(docs).set({
        content: body.content,
        title,
        version: doc.version + 1,
        isPublic: body.is_public ?? doc.isPublic,
        updatedAt: new Date(),
      }).where(eq(docs.id, doc.id));

      return c.json({
        slug: doc.slug,
        url: `${env.WEB_URL}/d/${doc.slug}`,
        is_new: false,
      });
    }
  }

  // Create new doc
  const slug = nanoid(10);
  await db.insert(docs).values({
    userId,
    slug,
    filePath: body.file_path ?? null,
    title,
    content: body.content,
    isPublic: body.is_public ?? false,
  });

  return c.json({
    slug,
    url: `${env.WEB_URL}/d/${slug}`,
    is_new: true,
  }, 201);
});

// GET /api/docs — list user's docs with filters
docsRouter.get("/", async (c) => {
  const userId = c.get("user").sub;
  const q = c.req.query("q");
  const readState = c.req.query("read_state");
  const visibility = c.req.query("visibility");

  const userDocs = await db
    .select({
      slug: docs.slug,
      title: docs.title,
      version: docs.version,
      isPublic: docs.isPublic,
      updatedAt: docs.updatedAt,
      readPct: readingPositions.scrollPct,
    })
    .from(docs)
    .leftJoin(readingPositions, and(
      eq(readingPositions.docId, docs.id),
      eq(readingPositions.userId, userId),
    ))
    .where(and(
      eq(docs.userId, userId),
      q ? ilike(docs.title, `%${q}%`) : undefined,
      visibility === "public" ? eq(docs.isPublic, true) : undefined,
      visibility === "private" ? eq(docs.isPublic, false) : undefined,
    ))
    .orderBy(sql`${docs.updatedAt} DESC`);

  let filtered = userDocs;
  if (readState === "not_started") filtered = userDocs.filter((d) => d.readPct === null || d.readPct === 0);
  if (readState === "reading") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct > 0 && d.readPct < 1);
  if (readState === "finished") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct >= 1);

  return c.json(filtered.map((d) => ({
    slug: d.slug,
    title: d.title,
    version: d.version,
    is_public: d.isPublic,
    updated_at: d.updatedAt.toISOString(),
    read_pct: d.readPct,
  })));
});

// GET /api/docs/:slug — get single doc (slug "latest" returns most recent)
docsRouter.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  // "latest" → resolve to user's most recently updated doc
  if (slug === "latest") {
    const user = c.get("user");
    if (!user) return c.json({ error: "not found" }, 404);
    const latest = await db.select().from(docs)
      .where(eq(docs.userId, user.sub))
      .orderBy(sql`${docs.updatedAt} DESC`)
      .limit(1);
    if (latest.length === 0) return c.json({ error: "no_docs" }, 404);
    const d = latest[0];
    return c.json({
      slug: d.slug,
      title: d.title,
      content: d.content,
      version: d.version,
      is_public: d.isPublic,
      created_at: d.createdAt.toISOString(),
      updated_at: d.updatedAt.toISOString(),
    });
  }

  const doc = await db.select().from(docs).where(eq(docs.slug, slug)).limit(1);

  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const d = doc[0];

  // Public docs are readable by anyone
  if (!d.isPublic) {
    const user = c.get("user");
    if (!user || user.sub !== d.userId) return c.json({ error: "not found" }, 404);
  }

  return c.json({
    slug: d.slug,
    title: d.title,
    content: d.content,
    version: d.version,
    is_public: d.isPublic,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  });
});

// PUT /api/docs/:slug — update content by slug
docsRouter.put("/:slug", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");
  const body = await c.req.json<{ content: string }>();

  const doc = await db.select().from(docs)
    .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
    .limit(1);

  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const title = body.content.match(/^#\s+(.+)$/m)?.[1] ?? doc[0].title;

  await db.update(docs).set({
    content: body.content,
    title,
    version: doc[0].version + 1,
    updatedAt: new Date(),
  }).where(eq(docs.id, doc[0].id));

  return c.json({
    slug,
    url: `${env.WEB_URL}/d/${slug}`,
    version: doc[0].version + 1,
  });
});

// PATCH /api/docs/:slug — update metadata
docsRouter.patch("/:slug", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");
  const body = await c.req.json<{ is_public?: boolean; title?: string }>();

  const doc = await db.select().from(docs)
    .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
    .limit(1);

  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const updates: Record<string, unknown> = {};
  if (body.is_public !== undefined) updates.isPublic = body.is_public;
  if (body.title !== undefined) updates.title = body.title;

  if (Object.keys(updates).length > 0) {
    await db.update(docs).set(updates).where(eq(docs.id, doc[0].id));
  }

  return c.json({ ok: true });
});

// DELETE /api/docs/:slug
docsRouter.delete("/:slug", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");

  const result = await db.delete(docs)
    .where(and(eq(docs.slug, slug), eq(docs.userId, userId)));

  return c.json({ ok: true });
});

export { docsRouter };
