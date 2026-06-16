import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { db } from "@pipeit/shared/db";
import { docs, users } from "@pipeit/shared/db/schema";
import { signJwt } from "@pipeit/shared/jwt";
import { eq } from "drizzle-orm";
import { app } from "./app.js";

// Track everything we create so the test DB stays clean across reruns.
const createdUserIds: string[] = [];

async function makeUser(): Promise<{ id: string; cookie: string }> {
  const [u] = await db
    .insert(users)
    .values({ name: "Test", email: `${randomUUID()}@test.local` })
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  const token = await signJwt({ sub: u.id, email: "test@test.local", name: "Test" });
  return { id: u.id, cookie: `token=${token}` };
}

async function makeDoc(userId: string, isPublic = false): Promise<string> {
  const slug = randomUUID().slice(0, 10);
  await db.insert(docs).values({ userId, slug, title: "T", content: "# T", isPublic });
  return slug;
}

after(async () => {
  // Cascade removes the users' docs (FK onDelete: cascade).
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
});

describe("Doc routes", () => {
  it("rejects unauthenticated upload", async () => {
    const res = await app.request("/api/docs", { method: "POST", body: JSON.stringify({ content: "# Hello" }) });
    assert.equal(res.status, 401);
  });

  it("PATCH toggles is_public for the owner", async () => {
    const owner = await makeUser();
    const slug = await makeDoc(owner.id, false);

    const res = await app.request(`/api/docs/${slug}`, {
      method: "PATCH",
      headers: { Cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: true }),
    });
    assert.equal(res.status, 200);

    const [row] = await db.select({ isPublic: docs.isPublic }).from(docs).where(eq(docs.slug, slug)).limit(1);
    assert.equal(row.isPublic, true);
  });

  it("PATCH on another user's doc returns 404 and leaves it unchanged", async () => {
    const owner = await makeUser();
    const attacker = await makeUser();
    const slug = await makeDoc(owner.id, false);

    const res = await app.request(`/api/docs/${slug}`, {
      method: "PATCH",
      headers: { Cookie: attacker.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: true }),
    });
    assert.equal(res.status, 404);

    const [row] = await db.select({ isPublic: docs.isPublic }).from(docs).where(eq(docs.slug, slug)).limit(1);
    assert.equal(row.isPublic, false);
  });

  it("DELETE removes the owner's doc", async () => {
    const owner = await makeUser();
    const slug = await makeDoc(owner.id, false);

    const res = await app.request(`/api/docs/${slug}`, {
      method: "DELETE",
      headers: { Cookie: owner.cookie },
    });
    assert.equal(res.status, 200);

    const rows = await db.select({ id: docs.id }).from(docs).where(eq(docs.slug, slug)).limit(1);
    assert.equal(rows.length, 0);
  });

  it("DELETE on another user's doc returns 404 and keeps the doc", async () => {
    const owner = await makeUser();
    const attacker = await makeUser();
    const slug = await makeDoc(owner.id, false);

    const res = await app.request(`/api/docs/${slug}`, {
      method: "DELETE",
      headers: { Cookie: attacker.cookie },
    });
    assert.equal(res.status, 404);

    const rows = await db.select({ id: docs.id }).from(docs).where(eq(docs.slug, slug)).limit(1);
    assert.equal(rows.length, 1);
  });

  it("GET reports is_owner true for the owner and false for anonymous", async () => {
    const owner = await makeUser();
    const slug = await makeDoc(owner.id, true); // public so anonymous can read it

    const ownerRes = await app.request(`/api/docs/${slug}`, { headers: { Cookie: owner.cookie } });
    assert.equal(ownerRes.status, 200);
    assert.equal((await ownerRes.json()).is_owner, true);

    const anonRes = await app.request(`/api/docs/${slug}`);
    assert.equal(anonRes.status, 200);
    assert.equal((await anonRes.json()).is_owner, false);
  });
});
