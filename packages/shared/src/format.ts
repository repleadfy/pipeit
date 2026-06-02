export type DocFormat = "markdown" | "html" | "txt" | "pdf";

const EXT_MAP: Record<string, DocFormat> = {
  md: "markdown",
  markdown: "markdown",
  mdown: "markdown",
  mkd: "markdown",
  html: "html",
  htm: "html",
  txt: "txt",
  text: "txt",
  pdf: "pdf",
};

function extOf(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)\s*$/);
  return m?.[1];
}

/** True if the first bytes are the PDF magic number `%PDF-`. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/** Sniff HTML from a text head: a doctype, <html>, <head>, or <body> near the start. */
function looksLikeHtml(content: string): boolean {
  const head = content.slice(0, 1000).toLowerCase().trimStart();
  return (
    /^<!doctype html/.test(head) || /^<html[\s>]/.test(head) || /^<head[\s>]/.test(head) || /^<body[\s>]/.test(head)
  );
}

/**
 * Auto-detect document format. Precedence: PDF magic bytes → filename extension →
 * HTML content sniff → markdown (default). The caller never passes a format; this
 * is the single source of truth.
 */
export function detectFormat(opts: { fileName?: string; content?: string; bytes?: Uint8Array }): DocFormat {
  if (opts.bytes && looksLikePdf(opts.bytes)) return "pdf";

  const ext = extOf(opts.fileName);
  if (ext && EXT_MAP[ext]) return EXT_MAP[ext];

  if (opts.content && looksLikeHtml(opts.content)) return "html";

  return "markdown";
}

/** Best-effort title per format. Falls back to the filename, then "Untitled". */
export function extractTitle(format: DocFormat, opts: { content?: string; fileName?: string }): string {
  const base = opts.fileName?.replace(/^.*[/\\]/, "").replace(/\.[a-z0-9]+$/i, "");
  const c = opts.content ?? "";

  switch (format) {
    case "markdown":
      return c.match(/^#\s+(.+)$/m)?.[1]?.trim() || base || "Untitled";
    case "html":
      return (
        c.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
        c
          .match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
          ?.replace(/<[^>]+>/g, "")
          .trim() ||
        base ||
        "Untitled"
      );
    case "txt":
      return (
        c
          .split("\n")
          .find((l) => l.trim())
          ?.trim()
          .slice(0, 120) ||
        base ||
        "Untitled"
      );
    case "pdf":
      return base || "Untitled";
  }
}
