import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { docs } from "@mpipe/shared/db/schema";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerToggleTool(server: McpServer, getUserId: () => string, getBaseUrl: () => string) {
  server.registerTool(
    "mpipe_toggle",
    {
      description: "Toggle a document's visibility between public and private.",
      inputSchema: z.object({
        slug: z.string().describe("The document slug"),
        is_public: z.boolean().describe("Set to true for public, false for private"),
      }),
    },
    async ({ slug, is_public }) => {
      const userId = getUserId();
      const baseUrl = getBaseUrl();

      const existing = await db.select({ id: docs.id }).from(docs)
        .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
        .limit(1);

      if (existing.length === 0) {
        return { content: [{ type: "text" as const, text: `Error: document "${slug}" not found or not owned by you.` }], isError: true };
      }

      await db.update(docs).set({ isPublic: is_public }).where(eq(docs.id, existing[0].id));
      const status = is_public ? "public" : "private";
      const url = `${baseUrl}/d/${slug}`;
      return { content: [{ type: "text" as const, text: `${url} is now ${status}` }] };
    }
  );
}
