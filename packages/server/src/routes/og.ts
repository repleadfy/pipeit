import { readFile } from "node:fs/promises";
import type { DocFormat } from "@pipeit/shared";
import { db } from "@pipeit/shared/db";
import { docs } from "@pipeit/shared/db/schema";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { env } from "../env.js";
import { renderFallbackPng, renderOgPng } from "../services/og-image.js";

const FORMAT_DESC: Record<DocFormat, string> = {
  markdown: "A Markdown document shared on pipeit.",
  html: "An HTML document shared on pipeit.",
  txt: "A text document shared on pipeit.",
  pdf: "A PDF document shared on pipeit.",
};

// ── Shared doc lookup ──────────────────────────────────────────────────────
async function findDoc(slug: string) {
  const rows = await db
    .select({
      title: docs.title,
      format: docs.format,
      version: docs.version,
      isPublic: docs.isPublic,
      updatedAt: docs.updatedAt,
    })
    .from(docs)
    .where(eq(docs.slug, slug))
    .limit(1);
  return rows[0];
}

// ── OG image endpoint: GET /d/:slug/og.png ─────────────────────────────────
// Public → per-doc card (cached by slug:version). Private or unknown → the
// generic fallback card, identical for both so a private doc's title and even
// its existence never leak (mirrors the 404-not-403 convention in docs.ts).
const imageCache = new Map<string, Buffer>();
const IMAGE_CACHE_MAX = 500;

function cachePut(key: string, buf: Buffer) {
  if (imageCache.size >= IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
  imageCache.set(key, buf);
}

let fallbackPng: Promise<Buffer> | null = null;
function getFallbackPng(): Promise<Buffer> {
  if (!fallbackPng) fallbackPng = renderFallbackPng();
  return fallbackPng;
}

export async function ogImageHandler(c: Context): Promise<Response> {
  const slug = c.req.param("slug");
  const doc = slug ? await findDoc(slug) : undefined;

  if (!slug || !doc?.isPublic) {
    const png = await getFallbackPng();
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
    });
  }

  const key = `${slug}:${doc.version}`;
  let png = imageCache.get(key);
  if (!png) {
    png = await renderOgPng({
      title: doc.title,
      format: doc.format,
      version: doc.version,
      dateISO: doc.updatedAt.toISOString(),
    });
    cachePut(key, png);
  }

  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}

// ── Per-doc meta injection: GET /d/:slug (production only) ──────────────────
// The prod server serves ./public/index.html for /d/:slug. We intercept it,
// and for PUBLIC docs rewrite the static og/twitter/title tags so crawlers get
// a per-doc card. Private/unknown docs get the untouched default HTML.

/** HTML-escape for injection into double-quoted attributes and <title> text.
 *  Titles are user-controlled (extractTitle can return raw HTML from a doc's
 *  own <title>/<h1>), so this is an XSS/attribute-breakout guard, not cosmetic. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface MetaValues {
  title: string;
  description: string;
  url: string;
  image: string;
}

// Replace a meta tag's content by selector, using a function replacer so `$`
// sequences in user content are never treated as replacement patterns.
function setMeta(html: string, attr: "property" | "name", key: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, "i");
  return html.replace(re, (_m, pre: string, post: string) => `${pre}${value}${post}`);
}

/** Rewrite the static social/SEO meta tags for a specific document. Pure.
 *  Titles are NFC-normalized so decomposed accents (e.g. "classificação" as
 *  c+combining-cedilla) compose to the precomposed characters before escaping. */
export function injectMeta(html: string, v: MetaValues): string {
  const title = esc(v.title.normalize("NFC"));
  const description = esc(v.description);
  let out = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${title} — pipeit</title>`);
  out = setMeta(out, "name", "description", description);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:url", v.url);
  out = setMeta(out, "property", "og:image", v.image);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", description);
  out = setMeta(out, "name", "twitter:image", v.image);
  return out;
}

// index.html is immutable per deploy — read once, memoize. `undefined` = not yet
// attempted; `null` = read failed (e.g. dev, no build) → fall through to the SPA.
let template: string | null | undefined;
async function loadTemplate(): Promise<string | null> {
  if (template !== undefined) return template;
  try {
    template = await readFile("./public/index.html", "utf8");
  } catch {
    template = null;
  }
  return template;
}

export async function docMetaHandler(c: Context): Promise<Response> {
  // In prod ./public/index.html always exists; a null template means no build
  // (dev), where this route isn't registered — 404 matches the static fallback.
  const html = await loadTemplate();
  if (!html) return c.notFound();

  const slug = c.req.param("slug");
  const doc = slug ? await findDoc(slug) : undefined;

  // Private/unknown → default HTML unchanged (no title/existence leak).
  if (!slug || !doc?.isPublic) {
    return c.html(html);
  }

  const injected = injectMeta(html, {
    title: doc.title,
    description: FORMAT_DESC[doc.format],
    url: `${env.PUBLIC_URL}/d/${slug}`,
    image: `${env.PUBLIC_URL}/d/${slug}/og.png`,
  });

  return new Response(injected, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
