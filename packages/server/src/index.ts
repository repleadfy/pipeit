import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`pipeit server listening on port ${info.port}`);
});
