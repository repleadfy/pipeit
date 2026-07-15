import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DocFormat } from "@pipeit/shared";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

const WIDTH = 1200;
const HEIGHT = 630;

// Fonts live at packages/server/fonts and are copied to /app/fonts in the Docker
// runtime image. From the compiled dist/services/og-image.js (and from
// src/services/og-image.ts under tsx in dev) `../../fonts` resolves to that dir.
const fontUrl = (file: string) => fileURLToPath(new URL(`../../fonts/${file}`, import.meta.url));

type SatoriFont = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fontsPromise: Promise<SatoriFont[]> | null = null;

// Loaded once, memoized. satori needs static TTF/OTF buffers (not woff2). If the
// font files are missing the promise rejects — surfaced by the caller as a 500 —
// rather than silently rendering an empty image.
function loadFonts(): Promise<SatoriFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(fontUrl("HankenGrotesk-Regular.ttf")),
      readFile(fontUrl("HankenGrotesk-Bold.ttf")),
    ]).then(([regular, bold]) => [
      { name: "Hanken Grotesk", data: regular, weight: 400, style: "normal" },
      { name: "Hanken Grotesk", data: bold, weight: 700, style: "normal" },
    ]);
  }
  return fontsPromise;
}

export interface OgCard {
  title: string;
  format: DocFormat;
  version: number;
  dateISO: string;
}

const BG = "#14141f";
const BG_GRADIENT = "linear-gradient(135deg, #1c1c30 0%, #0e0e18 100%)";
const FORMAT_LABEL: Record<DocFormat, string> = {
  markdown: "MARKDOWN",
  html: "HTML",
  txt: "TXT",
  pdf: "PDF",
};

// Minimal satori element factory — satori accepts React-element-shaped objects
// ({ type, props: { style, children } }); we build them directly to avoid a JSX
// toolchain and a React dependency the server package doesn't otherwise need.
// biome-ignore lint/suspicious/noExplicitAny: satori's style type is broad; a typed shim adds no safety here.
type El = { type: string; props: { style: Record<string, any>; children?: El | El[] | string } };
// biome-ignore lint/suspicious/noExplicitAny: see above.
const el = (type: string, style: Record<string, any>, children?: El | El[] | string): El => ({
  type,
  props: { style, children },
});

// The pipeit logo mark: three vertical bars with decreasing opacity, faithful to
// docs/assets/logo.svg (viewBox 6×44 bars, gap 9, opacity 1 / 0.6 / 0.3). White
// here since the card sits on a dark background (the SVG uses currentColor).
const logoMark = (unit: number): El => {
  const barHeight = unit * (44 / 6);
  const gap = unit * (9 / 6);
  const bar = (opacity: number, last: boolean): El =>
    el("div", {
      width: unit,
      height: barHeight,
      borderRadius: unit / 2,
      background: "#ffffff",
      opacity,
      marginRight: last ? 0 : gap,
    });
  return el("div", { display: "flex", alignItems: "center" }, [bar(1, false), bar(0.6, false), bar(0.3, true)]);
};

const wordmark = (fontSize: number): El =>
  el("div", { display: "flex", alignItems: "center", fontSize, fontWeight: 700, letterSpacing: -0.5 }, [
    logoMark(fontSize * 0.13),
    el("div", { display: "flex", marginLeft: fontSize * 0.34 }, "pipeit"),
  ]);

function formatDate(dateISO: string): string {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

function docTree(card: OgCard): El {
  return el(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: 72,
      background: BG,
      backgroundImage: BG_GRADIENT,
      color: "#ffffff",
      fontFamily: "Hanken Grotesk",
    },
    [
      // Top row: wordmark + format badge
      el("div", { display: "flex", alignItems: "center", justifyContent: "space-between" }, [
        wordmark(36),
        el(
          "div",
          {
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 3,
            padding: "10px 20px",
            borderRadius: 10,
            background: "rgba(232, 113, 74, 0.16)",
            color: "#f0a586",
          },
          FORMAT_LABEL[card.format],
        ),
      ]),
      // Title — clamped to 3 lines
      el(
        "div",
        {
          display: "-webkit-box",
          "-webkit-box-orient": "vertical",
          "-webkit-line-clamp": 3,
          overflow: "hidden",
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.12,
          letterSpacing: -1,
          wordBreak: "break-word",
        },
        // NFC-compose so decomposed input (e.g. "c"+combining-cedilla from macOS
        // filenames) uses the font's precomposed glyphs instead of rendering the
        // combining mark as tofu.
        card.title.normalize("NFC"),
      ),
      // Meta row
      el(
        "div",
        { display: "flex", fontSize: 28, fontWeight: 400, color: "rgba(255,255,255,0.66)" },
        `v${card.version} · ${formatDate(card.dateISO)}`,
      ),
    ],
  );
}

function fallbackTree(): El {
  return el(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: BG,
      backgroundImage: BG_GRADIENT,
      color: "#ffffff",
      fontFamily: "Hanken Grotesk",
    },
    [
      wordmark(104),
      el(
        "div",
        { display: "flex", fontSize: 34, fontWeight: 400, color: "rgba(255,255,255,0.66)", marginTop: 28 },
        "Pipe markdown out of your AI chats",
      ),
    ],
  );
}

async function toPng(tree: El): Promise<Buffer> {
  const fonts = await loadFonts();
  // biome-ignore lint/suspicious/noExplicitAny: tree is a satori-shaped element object.
  const svg = await satori(tree as any, { width: WIDTH, height: HEIGHT, fonts });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
  return Buffer.from(png);
}

/** Render the per-document social card (title + format badge + version · date). */
export function renderOgPng(card: OgCard): Promise<Buffer> {
  return toPng(docTree(card));
}

/** Render the generic branded card — served for private/unknown docs and as the
 *  site-wide default og.png. Never carries a document title. */
export function renderFallbackPng(): Promise<Buffer> {
  return toPng(fallbackTree());
}
