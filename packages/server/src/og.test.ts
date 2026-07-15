import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { db } from "@pipeit/shared/db";
import { docs, users } from "@pipeit/shared/db/schema";
import { eq } from "drizzle-orm";
import { app } from "./app.js";
import { esc, injectMeta } from "./routes/og.js";

const createdUserIds: string[] = [];

async function makeUser(): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({ name: "Test", email: `${randomUUID()}@test.local` })
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

async function makeDoc(userId: string, isPublic: boolean, title = "T"): Promise<string> {
  const slug = randomUUID().slice(0, 10);
  await db.insert(docs).values({ userId, slug, title, content: "# T", isPublic });
  return slug;
}

after(async () => {
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
});

// Minimal shell mirroring the real packages/web/index.html tag shapes (lines 6, 30-38).
const TEMPLATE = `<!doctype html><html><head>
<title>pipeit — pipe markdown out of your AI chats</title>
<meta name="description" content="Share markdown from AI conversations." />
<meta property="og:title" content="pipeit — pipe markdown out of your AI chats" />
<meta property="og:description" content="Share markdown from AI conversations." />
<meta property="og:url" content="https://pipeit.live" />
<meta property="og:image" content="https://pipeit.live/og.png" />
<meta name="twitter:title" content="pipeit" />
<meta name="twitter:description" content="Share markdown." />
<meta name="twitter:image" content="https://pipeit.live/og.png" />
</head><body></body></html>`;

describe("esc", () => {
  it("escapes all HTML-significant characters", () => {
    assert.equal(
      esc(`<script>alert(1)</script> & "x" 'y'`),
      "&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot; &#39;y&#39;",
    );
  });
});

describe("injectMeta", () => {
  const out = injectMeta(TEMPLATE, {
    title: `Runbook <b>& "prod"</b>`,
    description: "A Markdown document shared on pipeit.",
    url: "https://pipeit.live/d/abc123",
    image: "https://pipeit.live/d/abc123/og.png",
  });

  it("injects an escaped, per-doc <title>", () => {
    assert.match(out, /<title>Runbook &lt;b&gt;&amp; &quot;prod&quot;&lt;\/b&gt; — pipeit<\/title>/);
  });

  it("never emits the raw unescaped title (no attribute breakout / tag injection)", () => {
    assert.ok(!out.includes("<b>&"), "raw <b> leaked");
    assert.ok(!out.includes(`"prod"`), "raw unescaped quotes leaked");
  });

  it("points og:image and twitter:image at the absolute per-doc PNG", () => {
    assert.match(out, /property="og:image" content="https:\/\/pipeit\.live\/d\/abc123\/og\.png"/);
    assert.match(out, /name="twitter:image" content="https:\/\/pipeit\.live\/d\/abc123\/og\.png"/);
  });

  it("sets the canonical og:url", () => {
    assert.match(out, /property="og:url" content="https:\/\/pipeit\.live\/d\/abc123"/);
  });

  it("NFC-normalizes decomposed accents so they don't render as tofu", () => {
    const decomposed = "Classificação".normalize("NFD"); // c + combining cedilla, a + combining tilde
    const html = injectMeta(TEMPLATE, {
      title: decomposed,
      description: "x",
      url: "https://pipeit.live/d/x",
      image: "https://pipeit.live/d/x/og.png",
    });
    assert.ok(html.includes("Classificação"), "title not composed to NFC");
    // the raw combining marks (U+0327, U+0303) must be gone
    assert.ok(!/[̀-ͯ]/.test(html), "combining diacritical marks leaked into output");
  });
});

describe("GET /d/:slug/og.png", () => {
  it("returns a PNG for a public doc", async () => {
    const slug = await makeDoc(await makeUser(), true, "A Public Doc");
    const res = await app.request(`/d/${slug}/og.png`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^image\/png/);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 0);
    assert.equal(buf.subarray(0, 4).toString("hex"), "89504e47"); // PNG magic
  });

  it("renders a doc whose title has decomposed (NFD) accents", async () => {
    const slug = await makeDoc(await makeUser(), true, "Qualificação".normalize("NFD"));
    const res = await app.request(`/d/${slug}/og.png`);
    assert.equal(res.status, 200);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 4).toString("hex"), "89504e47");
  });

  it("serves the identical generic fallback for private and unknown slugs (no leak)", async () => {
    const uid = await makeUser();
    const privA = await makeDoc(uid, false, "Secret Plans A");
    const privB = await makeDoc(uid, false, "Secret Plans B");

    const [a, b, missing] = await Promise.all([
      app.request(`/d/${privA}/og.png`),
      app.request(`/d/${privB}/og.png`),
      app.request(`/d/does-not-ex/og.png`),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(missing.status, 200);

    const [ab, bb, mb] = await Promise.all([
      a.arrayBuffer().then(Buffer.from),
      b.arrayBuffer().then(Buffer.from),
      missing.arrayBuffer().then(Buffer.from),
    ]);
    // Two different private docs + a missing slug must all be byte-identical:
    // the card can't encode the title or reveal that the doc exists.
    assert.ok(ab.equals(bb), "private A and B differ");
    assert.ok(ab.equals(mb), "private and missing differ");
  });
});
