import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { oauthApp } from "./oauth.js";
import { mcpAuthMiddleware } from "./auth.js";
import { registerUploadTool } from "./tools/upload.js";
import { registerListTool } from "./tools/list.js";
import { registerDeleteTool } from "./tools/delete.js";
import { registerToggleTool } from "./tools/toggle.js";

const mcpApp = new Hono();

// OAuth routes (authorize, callback, token)
mcpApp.route("/", oauthApp);

// MCP Streamable HTTP endpoint — requires Bearer auth
mcpApp.all("/", mcpAuthMiddleware, async (c) => {
  const user = c.get("mcpUser");
  const baseUrl = process.env.PUBLIC_URL || new URL(c.req.url).origin;

  // Create per-request server with user context
  const server = new McpServer({
    name: "mpipe",
    version: "0.1.0",
  });

  const getUserId = () => user.sub;
  const getBaseUrl = () => baseUrl;

  registerUploadTool(server, getUserId, getBaseUrl);
  registerListTool(server, getUserId);
  registerDeleteTool(server, getUserId);
  registerToggleTool(server, getUserId, getBaseUrl);

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  return transport.handleRequest(c.req.raw);
});

export { mcpApp };
