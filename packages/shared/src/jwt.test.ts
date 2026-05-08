import assert from "node:assert";
import { describe, it } from "node:test";
import { signJwt, verifyJwt } from "./jwt.js";

describe("@pipeit/shared/jwt", () => {
  it("signs a token and verifies its claims roundtrip", async () => {
    const token = await signJwt({ sub: "u_1", email: "a@b.test", name: "Tester" });
    assert.equal(typeof token, "string");
    assert.ok(token.split(".").length === 3, "JWT should have 3 segments");

    const payload = await verifyJwt(token);
    assert.equal(payload.sub, "u_1");
    assert.equal(payload.email, "a@b.test");
    assert.equal(payload.name, "Tester");
  });

  it("rejects a tampered token", async () => {
    const token = await signJwt({ sub: "u_1", email: "a@b.test" });
    const tampered = `${token.slice(0, -4)}XXXX`;
    await assert.rejects(() => verifyJwt(tampered));
  });
});
