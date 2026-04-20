#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import * as http from "node:http";
import * as crypto from "node:crypto";
import { exec } from "node:child_process";

const BASE = process.env.PIPEIT_URL ?? "https://pipeit.live";
const TOKEN_PATH = join(homedir(), ".config", "pipeit", "token");

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function register(): Promise<string> {
  const r = await fetch(`${BASE}/mcp/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "pipeit-cli",
      redirect_uris: [],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!r.ok) throw new Error(`register failed: ${r.status}`);
  const j = (await r.json()) as { client_id: string };
  return j.client_id;
}

async function login(): Promise<string> {
  const clientId = await register();
  const { verifier, challenge } = pkce();
  const state = crypto.randomBytes(16).toString("hex");
  const port = 52000 + Math.floor(Math.random() * 1000);
  const redirectUri = `http://localhost:${port}/callback`;

  const qs = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const authUrl = `${BASE}/mcp/authorize?${qs}`;

  const code: string = await new Promise((resolveP, rejectP) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const c = url.searchParams.get("code");
      const s = url.searchParams.get("state");
      const err = url.searchParams.get("error");
      res.writeHead(err || !c ? 400 : 200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        err || !c
          ? `<h1>Auth error</h1><p>${err ?? "no code returned"}</p>`
          : "<h1>pipeit-cli authorized. You can close this tab.</h1>",
      );
      server.close();
      if (err) return rejectP(new Error(`auth error: ${err}`));
      if (!c) return rejectP(new Error("no code returned"));
      if (s !== state) return rejectP(new Error("state mismatch"));
      resolveP(c);
    });
    server.listen(port, () => {
      const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start ''" : "xdg-open";
      exec(`${openCmd} "${authUrl}"`, () => {});
      process.stderr.write(`Authorize in browser (or open manually):\n  ${authUrl}\n`);
    });
  });

  const tokR = await fetch(`${BASE}/mcp/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: clientId,
    }).toString(),
  });
  if (!tokR.ok) throw new Error(`token exchange failed: ${tokR.status} ${await tokR.text()}`);
  const tokJ = (await tokR.json()) as { access_token: string };

  mkdirSync(join(homedir(), ".config", "pipeit"), { recursive: true });
  writeFileSync(TOKEN_PATH, tokJ.access_token, { mode: 0o600 });
  return tokJ.access_token;
}

async function getToken(forceLogin = false): Promise<string> {
  if (!forceLogin && existsSync(TOKEN_PATH)) return readFileSync(TOKEN_PATH, "utf8").trim();
  return await login();
}

async function upload(filePath: string, opts: { isPublic: boolean; forceNew: boolean }): Promise<string> {
  const abs = resolve(filePath);
  const content = readFileSync(abs, "utf8");
  const body = JSON.stringify({
    content,
    file_path: opts.forceNew ? undefined : abs,
    is_public: opts.isPublic,
  });

  const post = (token: string) =>
    fetch(`${BASE}/api/docs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
    });

  let token = await getToken();
  let r = await post(token);
  if (r.status === 401) {
    token = await getToken(true);
    r = await post(token);
  }
  if (!r.ok) throw new Error(`upload failed: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { url: string };
  return j.url;
}

function parseArgs(argv: string[]): { file?: string; isPublic: boolean; forceNew: boolean; logout: boolean; help: boolean } {
  const out = { file: undefined as string | undefined, isPublic: false, forceNew: false, logout: false, help: false };
  for (const a of argv) {
    if (a === "--public") out.isPublic = true;
    else if (a === "--new") out.forceNew = true;
    else if (a === "--logout") out.logout = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if (!a.startsWith("--")) out.file = a;
  }
  return out;
}

function printHelp() {
  process.stderr.write(
    `pipeit-upload — upload a markdown file to pipeit.live\n\n` +
      `Usage:\n` +
      `  pipeit-upload [--public] [--new] <file.md>\n` +
      `  pipeit-upload --logout\n\n` +
      `Flags:\n` +
      `  --public   make the doc publicly shareable\n` +
      `  --new      force new link (don't update-in-place)\n` +
      `  --logout   delete the cached token\n\n` +
      `First run opens a browser to authorize. Token cached at ~/.config/pipeit/token.\n`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args.logout) {
    if (existsSync(TOKEN_PATH)) writeFileSync(TOKEN_PATH, "");
    process.stderr.write("logged out\n");
    return;
  }
  if (!args.file) {
    printHelp();
    process.exit(2);
  }
  const url = await upload(args.file, { isPublic: args.isPublic, forceNew: args.forceNew });
  process.stdout.write(url + "\n");
}

main().catch((err) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
