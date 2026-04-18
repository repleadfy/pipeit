import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@pipeit/shared/db";
import { docs } from "@pipeit/shared/db/schema";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerDeleteTool(server: McpServer, getUserId: () => string) {
  server.registerTool(
    "pipeit_delete",
    {
      description: "Delete a document from pipeit by its slug.",
      inputSchema: z.object({
        slug: z.string().describe("The document slug (from the URL /d/<slug>)"),
      }),
    },
    async ({ slug }) => {
      const userId = getUserId();

      const existing = await db.select({ id: docs.id }).from(docs)
        .where(and(eq(docs.slug, slug), eq(docs.userId, userId)))
        .limit(1);

      if (existing.length === 0) {
        return { content: [{ type: "text" as const, text: `Error: document "${slug}" not found or not owned by you.` }], isError: true };
      }

      await db.delete(docs).where(eq(docs.id, existing[0].id));
      return { content: [{ type: "text" as const, text: `Deleted: /d/${slug}` }] };
    }
  );
}
