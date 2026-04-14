import { Hono } from "hono";

const mcpApp = new Hono();

mcpApp.get("/health", (c) => c.json({ status: "ok", service: "mcp" }));

export { mcpApp };
