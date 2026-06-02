import type { McpServer } from "@modelcontextprotocol/server";
import { detectFormat, extractTitle } from "@pipeit/shared";
import { db } from "@pipeit/shared/db";
import { docs } from "@pipeit/shared/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

export function registerUploadTool(server: McpServer, getUserId: () => string, getBaseUrl: () => string) {
  server.registerTool(
    "pipeit_upload",
    {
      description:
        "Upload or update a text document on pipeit (markdown, HTML, or plain text — format is auto-detected). If file_path is provided and a doc exists with the same path, it updates in place. Otherwise creates a new doc. For PDFs, use the web upload or CLI.",
      inputSchema: z.object({
        content: z.string().describe("Document content (markdown, HTML, or plain text)"),
        file_path: z
          .string()
          .optional()
          .describe("Original file path — used for update-in-place matching and format detection"),
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

      const format = detectFormat({ fileName: file_path, content });
      const title = extractTitle(format, { content, fileName: file_path });

      // Update-in-place if same user + same file_path
      if (file_path) {
        const existing = await db
          .select()
          .from(docs)
          .where(and(eq(docs.userId, userId), eq(docs.filePath, file_path)))
          .limit(1);

        if (existing.length > 0) {
          const doc = existing[0];
          await db
            .update(docs)
            .set({
              content,
              title,
              format,
              version: doc.version + 1,
              isPublic: is_public ?? doc.isPublic,
              updatedAt: new Date(),
            })
            .where(eq(docs.id, doc.id));

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
        format,
        content,
        isPublic: is_public ?? false,
      });

      const url = `${baseUrl}/d/${slug}`;
      return { content: [{ type: "text" as const, text: `Created: ${url}` }] };
    },
  );
}
