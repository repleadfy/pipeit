import { describe, it } from "node:test";
import assert from "node:assert";
import { app } from "./app.js";

describe("Doc routes", () => {
  it("rejects unauthenticated upload", async () => {
    const res = await app.request("/api/docs", { method: "POST", body: JSON.stringify({ content: "# Hello" }) });
    assert.equal(res.status, 401);
  });
});
