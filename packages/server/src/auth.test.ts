import { describe, it } from "node:test";
import assert from "node:assert";
import { signJwt, verifyJwt } from "./auth/jwt.js";

describe("JWT", () => {
  it("signs and verifies a token", async () => {
    const payload = { sub: "user-123", email: "test@example.com" };
    const token = await signJwt(payload);
    assert.ok(typeof token === "string");
    const decoded = await verifyJwt(token);
    assert.equal(decoded.sub, "user-123");
    assert.equal(decoded.email, "test@example.com");
  });

  it("rejects invalid token", async () => {
    await assert.rejects(() => verifyJwt("invalid.token.here"), {
      name: "JWSInvalid",
    });
  });
});
