import assert from "node:assert/strict";
import { test } from "node:test";
import { detectFormat, extractTitle, looksLikePdf } from "./format.js";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

test("detects PDF by magic bytes regardless of name", () => {
  assert.equal(detectFormat({ bytes: PDF_BYTES }), "pdf");
  assert.equal(detectFormat({ fileName: "weird.txt", bytes: PDF_BYTES }), "pdf");
  assert.equal(looksLikePdf(PDF_BYTES), true);
});

test("detects by extension", () => {
  assert.equal(detectFormat({ fileName: "a.md" }), "markdown");
  assert.equal(detectFormat({ fileName: "a.markdown" }), "markdown");
  assert.equal(detectFormat({ fileName: "a.html" }), "html");
  assert.equal(detectFormat({ fileName: "a.htm" }), "html");
  assert.equal(detectFormat({ fileName: "a.txt" }), "txt");
  assert.equal(detectFormat({ fileName: "a.pdf" }), "pdf");
});

test("sniffs HTML from content when no telling extension", () => {
  assert.equal(detectFormat({ content: "<!DOCTYPE html><html><body>hi</body></html>" }), "html");
  assert.equal(detectFormat({ content: '  <html lang="en">x</html>' }), "html");
  assert.equal(detectFormat({ content: "<body>x</body>" }), "html");
});

test("extension wins over content sniff", () => {
  // .txt of literal HTML should stay txt (user named it .txt deliberately)
  assert.equal(detectFormat({ fileName: "snippet.txt", content: "<html>x</html>" }), "txt");
});

test("defaults to markdown", () => {
  assert.equal(detectFormat({ content: "# Title\n\nbody" }), "markdown");
  assert.equal(detectFormat({}), "markdown");
});

test("extractTitle per format", () => {
  assert.equal(extractTitle("markdown", { content: "# Hello\nx" }), "Hello");
  assert.equal(extractTitle("html", { content: "<title>Doc Title</title>" }), "Doc Title");
  assert.equal(extractTitle("html", { content: "<h1>Heading</h1>" }), "Heading");
  assert.equal(extractTitle("txt", { content: "first line\nsecond" }), "first line");
  assert.equal(extractTitle("pdf", { fileName: "/tmp/report.pdf" }), "report");
  assert.equal(extractTitle("markdown", { fileName: "notes.md" }), "notes");
});
