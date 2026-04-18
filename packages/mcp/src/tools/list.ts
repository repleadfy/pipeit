import { z } from "zod";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { docs, readingPositions } from "@pipeit/shared/db/schema";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerListTool(server: McpServer, getUserId: () => string) {
  server.registerTool(
    "pipeit_list",
    {
      description: "List your documents on pipeit. Supports search, read state, and visibility filters.",
      inputSchema: z.object({
        q: z.string().optional().describe("Search query to filter by title"),
        read_state: z.enum(["not_started", "reading", "finished"]).optional().describe("Filter by reading progress"),
        visibility: z.enum(["public", "private"]).optional().describe("Filter by visibility"),
      }),
    },
    async ({ q, read_state, visibility }) => {
      const userId = getUserId();

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
      if (read_state === "not_started") filtered = userDocs.filter((d) => d.readPct === null || d.readPct === 0);
      if (read_state === "reading") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct > 0 && d.readPct < 1);
      if (read_state === "finished") filtered = userDocs.filter((d) => d.readPct !== null && d.readPct >= 1);

      const text = filtered.length === 0
        ? "No documents found."
        : filtered.map((d) =>
            `- **${d.title}** (${d.isPublic ? "public" : "private"}) — v${d.version}, ${d.updatedAt.toISOString().slice(0, 10)} — /d/${d.slug}`
          ).join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
