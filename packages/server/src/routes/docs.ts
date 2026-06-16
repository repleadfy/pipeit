import { type DocFormat, detectFormat, extractTitle } from "@pipeit/shared";
import { db } from "@pipeit/shared/db";
import { docBlobs, docs, readingPositions } from "@pipeit/shared/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { env } from "../env.js";

const docsRouter = new Hono();

const TEXT_LIMIT = 1_000_000; // 1 MB for md/html/txt
const PDF_LIMIT = 25_000_000; // 25 MB for binary PDFs

type UpsertInput = {
  userId: string;
  filePath: string | null;
  isPublic: boolean;
  format: DocFormat;
  title: string;
  content: string;
  blob?: { data: Buffer; mimeType: string };
};

// Create, or update-in-place when the same user re-uploads the same file_path.
async function upsertDoc(input: UpsertInput): Promise<{ slug: string; isNew: boolean; version: number }> {
  const existing = input.filePath
    ? await db
        .select()
        .from(docs)
        .where(and(eq(docs.userId, input.userId), eq(docs.filePath, input.filePath)))
        .limit(1)
    : [];

  if (existing.length > 0) {
    const doc = existing[0];
    const version = doc.version + 1;
    await db
      .update(docs)
      .set({
        content: input.content,
        title: input.title,
        format: input.format,
        version,
        isPublic: input.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(docs.id, doc.id));

    if (input.blob) {
      await db
        .insert(docBlobs)
        .values({
          docId: doc.id,
          data: input.blob.data,
          mimeType: input.blob.mimeType,
          byteSize: input.blob.data.length,
        })
        .onConflictDoUpdate({
          target: docBlobs.docId,
          set: { data: input.blob.data, mimeType: input.blob.mimeType, byteSize: input.blob.data.length },
        });
    } else {
      await db.delete(docBlobs).where(eq(docBlobs.docId, doc.id));
    }

    return { slug: doc.slug, isNew: false, version };
  }

  const slug = nanoid(10);
  const inserted = await db
    .insert(docs)
    .values({
      userId: input.userId,
      slug,
      filePath: input.filePath,
      title: input.title,
      format: input.format,
      content: input.content,
      isPublic: input.isPublic,
    })
    .returning({ id: docs.id });

  if (input.blob) {
    await db.insert(docBlobs).values({
      docId: inserted[0].id,
      data: input.blob.data,
      mimeType: input.blob.mimeType,
      byteSize: input.blob.data.length,
    });
  }

  return { slug, isNew: true, version: 1 };
}

// POST /api/docs — upload or update-in-place.
// Accepts JSON (text formats: markdown/html/txt) or multipart/form-data (any file,
// including binary PDFs). Format is auto-detected — clients never declare it.
docsRouter.post("/", async (c) => {
  const userId = c.get("user").sub;
  const contentType = c.req.header("content-type") ?? "";

  // Multipart: file upload (the only path that can carry a binary PDF).
  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);

    const filePath = typeof form.file_path === "string" ? form.file_path : file.name || null;
    const isPublic = form.is_public === "true" || form.is_public === "1";
    const bytes = Buffer.from(await file.arrayBuffer());

    const format = detectFormat({ fileName: file.name, bytes });

    if (format === "pdf") {
      if (bytes.length > PDF_LIMIT) return c.json({ error: "PDF exceeds 25MB limit" }, 413);
      const title = extractTitle("pdf", { fileName: file.name });
      const result = await upsertDoc({
        userId,
        filePath,
        isPublic,
        format,
        title,
        content: "",
        blob: { data: bytes, mimeType: "application/pdf" },
      });
      return c.json(
        { slug: result.slug, url: `${env.WEB_URL}/d/${result.slug}`, is_new: result.isNew },
        result.isNew ? 201 : 200,
      );
    }

    // Non-PDF file: treat as text, re-detect from decoded content + name.
    const text = bytes.toString("utf8");
    if (text.length > TEXT_LIMIT) return c.json({ error: "content exceeds 1MB limit" }, 413);
    const textFormat = detectFormat({ fileName: file.name, content: text });
    const title = extractTitle(textFormat, { content: text, fileName: file.name });
    const result = await upsertDoc({ userId, filePath, isPublic, format: textFormat, title, content: text });
    return c.json(
      { slug: result.slug, url: `${env.WEB_URL}/d/${result.slug}`, is_new: result.isNew },
      result.isNew ? 201 : 200,
    );
  }

  // JSON: text payload (markdown / html / txt).
  const body = await c.req.json<{ content: string; file_path?: string; is_public?: boolean }>();
  if (!body.content) return c.json({ error: "content is required" }, 400);
  if (body.content.length > TEXT_LIMIT) return c.json({ error: "content exceeds 1MB limit" }, 413);

  const format = detectFormat({ fileName: body.file_path, content: body.content });
  const title = extractTitle(format, { content: body.content, fileName: body.file_path });
  const result = await upsertDoc({
    userId,
    filePath: body.file_path ?? null,
    isPublic: body.is_public ?? false,
    format,
    title,
    content: body.content,
  });

  return c.json(
    { slug: result.slug, url: `${env.WEB_URL}/d/${result.slug}`, is_new: result.isNew },
    result.isNew ? 201 : 200,
  );
});

// GET /api/docs — list user's docs with filters
docsRouter.get("/", async (c) => {
  const userId = c.get("user").sub;
  const q = c.req.query("q");
  const readState = c.req.query("read_state");
  const visibility = c.req.query("visibility");

  // Full-text search across title (weight A) + content (weight B) via the
  // generated search_vector. websearch_to_tsquery safely parses raw user input
  // (no thrown syntax errors), and ts_rank orders by relevance — title hits
  // outrank body hits, ties broken by recency.
  const tsQuery = q?.trim() ? sql`websearch_to_tsquery('english', ${q})` : null;

  const userDocs = await db
    .select({
      slug: docs.slug,
      title: docs.title,
      format: docs.format,
      version: docs.version,
      isPublic: docs.isPublic,
      updatedAt: docs.updatedAt,
      readPct: readingPositions.scrollPct,
    })
    .from(docs)
    .leftJoin(readingPositions, and(eq(readingPositions.docId, docs.id), eq(readingPositions.userId, userId)))
    .where(
      and(
        eq(docs.userId, userId),
        tsQuery ? sql`${docs.searchVector} @@ ${tsQuery}` : undefined,
        visibility === "public" ? eq(docs.isPublic, true) : undefined,
        visibility === "private" ? eq(docs.isPublic, false) : undefined,
      ),
    )
    .orderBy(
      tsQuery
        ? sql`ts_rank(${docs.searchVector}, ${tsQuery}) DESC, ${docs.updatedAt} DESC`
        : sql`${docs.updatedAt} DESC`,
    );

  let filtered = userDocs;
  if (readState === "not_started") filtered = userDocs.filter((d) => d.readPct === null || d.readPct === 0);
  if (readState === "reading") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct > 0 && d.readPct < 1);
  if (readState === "finished") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct >= 1);

  return c.json(
    filtered.map((d) => ({
      slug: d.slug,
      title: d.title,
      format: d.format,
      version: d.version,
      is_public: d.isPublic,
      updated_at: d.updatedAt.toISOString(),
      read_pct: d.readPct,
    })),
  );
});

// GET /api/docs/:slug/raw — serve the raw bytes (PDFs). Inline so iframes/<embed> render it.
docsRouter.get("/:slug/raw", async (c) => {
  const slug = c.req.param("slug");
  const doc = await db.select().from(docs).where(eq(docs.slug, slug)).limit(1);
  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const d = doc[0];
  if (!d.isPublic) {
    const user = c.get("user");
    if (!user || user.sub !== d.userId) return c.json({ error: "not found" }, 404);
  }

  const blob = await db.select().from(docBlobs).where(eq(docBlobs.docId, d.id)).limit(1);
  if (blob.length === 0) return c.json({ error: "not found" }, 404);

  const b = blob[0];
  return new Response(new Uint8Array(b.data), {
    headers: {
      "Content-Type": b.mimeType,
      "Content-Length": String(b.byteSize),
      "Content-Disposition": `inline; filename="${d.slug}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});

// GET /api/docs/:slug — get single doc (slug "latest" returns most recent)
docsRouter.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  // "latest" → resolve to user's most recently updated doc
  if (slug === "latest") {
    const user = c.get("user");
    if (!user) return c.json({ error: "not found" }, 404);
    const latest = await db
      .select()
      .from(docs)
      .where(eq(docs.userId, user.sub))
      .orderBy(sql`${docs.updatedAt} DESC`)
      .limit(1);
    if (latest.length === 0) return c.json({ error: "no_docs" }, 404);
    const d = latest[0];
    return c.json({
      slug: d.slug,
      title: d.title,
      format: d.format,
      content: d.content,
      version: d.version,
      is_public: d.isPublic,
      is_owner: c.get("user")?.sub === d.userId,
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
    format: d.format,
    content: d.content,
    version: d.version,
    is_public: d.isPublic,
    is_owner: c.get("user")?.sub === d.userId,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  });
});

// PUT /api/docs/:slug — update content by slug
docsRouter.put("/:slug", async (c) => {
  const userId = c.get("user").sub;
  const slug = c.req.param("slug");
  const body = await c.req.json<{ content: string }>();

  const doc = await db
    .select()
    .from(docs)
    .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
    .limit(1);

  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  const format = detectFormat({ fileName: doc[0].filePath ?? undefined, content: body.content });
  const title = extractTitle(format, { content: body.content, fileName: doc[0].filePath ?? undefined });

  await db
    .update(docs)
    .set({
      content: body.content,
      title,
      format,
      version: doc[0].version + 1,
      updatedAt: new Date(),
    })
    .where(eq(docs.id, doc[0].id));

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

  const doc = await db
    .select()
    .from(docs)
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

  // Fetch-then-check: only the owner may delete. Returns 404 (not 403) for a
  // non-owner so we don't leak the existence of another user's doc.
  const doc = await db
    .select({ id: docs.id })
    .from(docs)
    .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
    .limit(1);

  if (doc.length === 0) return c.json({ error: "not found" }, 404);

  // Cascades to doc_blobs and reading_positions via FK onDelete: cascade.
  await db.delete(docs).where(eq(docs.id, doc[0].id));

  return c.json({ ok: true });
});

export { docsRouter };
