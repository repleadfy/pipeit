import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArgs, slugFromTarget } from "./upload-cli.js";

test("parseArgs treats a plain path as a file upload", () => {
  const a = parseArgs(["./README.md"]);
  assert.equal(a.file, "./README.md");
  assert.equal(a.command, undefined);
});

test("parseArgs keeps upload flags", () => {
  const a = parseArgs(["--public", "--new", "./doc.md"]);
  assert.equal(a.file, "./doc.md");
  assert.equal(a.isPublic, true);
  assert.equal(a.forceNew, true);
});

test("parseArgs recognizes the delete subcommand and target", () => {
  const a = parseArgs(["delete", "x9k2"]);
  assert.equal(a.command, "delete");
  assert.equal(a.target, "x9k2");
  assert.equal(a.file, undefined);
});

test("parseArgs recognizes public/private subcommands", () => {
  assert.equal(parseArgs(["public", "x9k2"]).command, "public");
  assert.equal(parseArgs(["private", "x9k2"]).command, "private");
});

test("parseArgs handles --logout and --help", () => {
  assert.equal(parseArgs(["--logout"]).logout, true);
  assert.equal(parseArgs(["-h"]).help, true);
});

test("slugFromTarget extracts the slug from a full URL", () => {
  assert.equal(slugFromTarget("https://pipeit.live/d/x9k2"), "x9k2");
  assert.equal(slugFromTarget("https://pipeit.live/d/x9k2?ref=1"), "x9k2");
  assert.equal(slugFromTarget("http://localhost:5173/d/abc123/"), "abc123");
});

test("slugFromTarget passes a bare slug through", () => {
  assert.equal(slugFromTarget("x9k2"), "x9k2");
  assert.equal(slugFromTarget("  x9k2  "), "x9k2");
});
