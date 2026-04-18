import { test } from "node:test";
import assert from "node:assert/strict";
import { hasClaudeCli, tryInstallViaCli, printManualInstructions, printNextStep } from "./cli.js";

test("hasClaudeCli returns false when spawn status is non-zero", () => {
  const spawn = () => ({ status: 127 } as { status: number });
  assert.equal(hasClaudeCli(spawn), false);
});

test("hasClaudeCli returns true when spawn status is zero", () => {
  const spawn = () => ({ status: 0 } as { status: number });
  assert.equal(hasClaudeCli(spawn), true);
});

test("tryInstallViaCli returns true when both exec calls succeed", () => {
  const calls: string[] = [];
  const exec = (cmd: string) => { calls.push(cmd); };
  assert.equal(tryInstallViaCli(exec), true);
  assert.deepEqual(calls, [
    "claude plugin marketplace add repleadfy/pipeit",
    "claude plugin install pipeit@repleadfy/pipeit",
  ]);
});

test("tryInstallViaCli returns false if exec throws", () => {
  const exec = () => { throw new Error("not found"); };
  assert.equal(tryInstallViaCli(exec), false);
});

test("printManualInstructions writes the two /plugin lines", () => {
  const lines: string[] = [];
  printManualInstructions((s) => lines.push(s));
  assert.ok(lines.some((l) => l.includes("/plugin marketplace add repleadfy/pipeit")));
  assert.ok(lines.some((l) => l.includes("/plugin install pipeit")));
});

test("printNextStep mentions /pipeit and browser sign-in", () => {
  const lines: string[] = [];
  printNextStep((s) => lines.push(s));
  const joined = lines.join("\n");
  assert.match(joined, /\/pipeit/);
  assert.match(joined, /browser/i);
});
