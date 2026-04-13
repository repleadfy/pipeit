import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { google } from "./auth/google.js";
import { authMiddleware } from "./auth/middleware.js";

const app = new Hono();

app.use("*", cors({
  origin: [env.WEB_URL, env.PUBLIC_URL],
  credentials: true,
}));

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/auth", google);

app.use("/api/*", authMiddleware);

export { app };
