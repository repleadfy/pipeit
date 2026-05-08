import assert from "node:assert";
import { describe, it } from "node:test";
import { oauthApp } from "./oauth.js";

describe("@pipeit/mcp/oauth", () => {
  it("dynamic client registration mints a client_id", async () => {
    const res = await oauthApp.request("/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "test client", redirect_uris: ["http://localhost/cb"] }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { client_id: string; client_name: string };
    assert.equal(typeof body.client_id, "string");
    assert.ok(body.client_id.length >= 16);
    assert.equal(body.client_name, "test client");
  });

  it("/authorize without redirect_uri returns 400", async () => {
    const res = await oauthApp.request("/authorize?client_id=abc&code_challenge=xyz");
    assert.equal(res.status, 400);
  });

  it("/consent-info without pending state returns 404", async () => {
    const res = await oauthApp.request("/consent-info");
    assert.equal(res.status, 404);
  });

  it("/token rejects unsupported grant_type", async () => {
    const res = await oauthApp.request("/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=password&code=x&code_verifier=y&redirect_uri=z",
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "unsupported_grant_type");
  });

  it("/token rejects an unknown auth code", async () => {
    const res = await oauthApp.request("/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code&code=does-not-exist&code_verifier=v&redirect_uri=http://localhost/cb",
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "invalid_grant");
  });
});
