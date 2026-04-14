import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { docs } from "@mpipe/shared/db/schema";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerUploadTool(server: McpServer, getUserId: () => string, getBaseUrl: () => string) {
  server.registerTool(
    "mpipe_upload",
    {
      description: "Upload or update a markdown document on mpipe. If file_path is provided and a doc exists with the same path, it updates in place. Otherwise creates a new doc.",
      inputSchema: z.object({
        content: z.string().describe("Markdown content to upload"),
        file_path: z.string().optional().describe("Original file path — used for update-in-place matching"),
        is_public: z.boolean().optional().default(false).describe("Make the document publicly shareable"),
      }),
    },
    async ({ content, file_path, is_public }) => {
      const userId = getUserId();
      const baseUrl = getBaseUrl();

      if (!content) {
        return { content: [{ type: "text" as const, text: "Error: content is required" }], isError: true };
      }
      if (content.length > 1_000_000) {
        return { content: [{ type: "text" as const, text: "Error: content exceeds 1MB limit" }], isError: true };
      }

      const title = content.match(/^#\s+(.+)$/m)?.[1] ?? "Untitled";

      // Update-in-place if same user + same file_path
      if (file_path) {
        const existing = await db.select().from(docs)
          .where(and(eq(docs.userId, userId), eq(docs.filePath, file_path)))
          .limit(1);

        if (existing.length > 0) {
          const doc = existing[0];
          await db.update(docs).set({
            content,
            title,
            version: doc.version + 1,
            isPublic: is_public ?? doc.isPublic,
            updatedAt: new Date(),
          }).where(eq(docs.id, doc.id));

          const url = `${baseUrl}/d/${doc.slug}`;
          return { content: [{ type: "text" as const, text: `Updated: ${url} (v${doc.version + 1})` }] };
        }
      }

      // Create new doc
      const slug = nanoid(10);
      await db.insert(docs).values({
        userId,
        slug,
        filePath: file_path ?? null,
        title,
        content,
        isPublic: is_public ?? false,
      });

      const url = `${baseUrl}/d/${slug}`;
      return { content: [{ type: "text" as const, text: `Created: ${url}` }] };
    }
  );
}
