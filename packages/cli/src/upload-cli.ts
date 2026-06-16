#!/usr/bin/env node
import { exec } from "node:child_process";
import * as crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as http from "node:http";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function isBinaryDoc(abs: string, bytes: Buffer): boolean {
  if (/\.pdf$/i.test(abs)) return true;
  // %PDF- magic number
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

// Run an authenticated request, transparently re-authing once on a 401 (expired token).
async function authedRequest(makeReq: (token: string) => Promise<Response>): Promise<Response> {
  let token = await getToken();
  let r = await makeReq(token);
  if (r.status === 401) {
    token = await getToken(true);
    r = await makeReq(token);
  }
  return r;
}

/** Accept either a bare slug or a full pipeit URL (…/d/<slug>) and return the slug. */
export function slugFromTarget(target: string): string {
  const m = target.match(/\/d\/([^/?#]+)/);
  return (m ? m[1] : target).trim();
}

async function upload(filePath: string, opts: { isPublic: boolean; forceNew: boolean }): Promise<string> {
  const abs = resolve(filePath);
  const bytes = readFileSync(abs);
  const fileName = abs.replace(/^.*[/\\]/, "");

  // Binary files (PDFs) go as multipart; the server auto-detects the format.
  // Text files stay on the JSON path. Either way the client never declares a format.
  const post = isBinaryDoc(abs, bytes)
    ? (token: string) => {
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), fileName);
        if (!opts.forceNew) form.append("file_path", abs);
        form.append("is_public", String(opts.isPublic));
        return fetch(`${BASE}/api/docs`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      }
    : (token: string) =>
        fetch(`${BASE}/api/docs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: bytes.toString("utf8"),
            file_path: opts.forceNew ? undefined : abs,
            is_public: opts.isPublic,
          }),
        });

  const r = await authedRequest(post);
  if (!r.ok) throw new Error(`upload failed: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { url: string };
  return j.url;
}

// Toggle a doc's visibility. The server enforces ownership — a 404 means the doc
// doesn't exist OR isn't yours (it never reveals which).
async function setVisibility(target: string, isPublic: boolean): Promise<string> {
  const slug = slugFromTarget(target);
  const r = await authedRequest((token) =>
    fetch(`${BASE}/api/docs/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: isPublic }),
    }),
  );
  if (r.status === 404) throw new Error(`doc "${slug}" not found or not yours`);
  if (!r.ok) throw new Error(`failed: ${r.status} ${await r.text()}`);
  return slug;
}

// Delete a doc you own. Same ownership rule: a non-owner gets a 404.
async function deleteDoc(target: string): Promise<string> {
  const slug = slugFromTarget(target);
  const r = await authedRequest((token) =>
    fetch(`${BASE}/api/docs/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  if (r.status === 404) throw new Error(`doc "${slug}" not found or not yours`);
  if (!r.ok) throw new Error(`failed: ${r.status} ${await r.text()}`);
  return slug;
}

export type Command = "delete" | "public" | "private";
const COMMANDS = new Set<Command>(["delete", "public", "private"]);

export function parseArgs(argv: string[]): {
  command?: Command;
  target?: string;
  file?: string;
  isPublic: boolean;
  forceNew: boolean;
  logout: boolean;
  help: boolean;
} {
  const out = {
    command: undefined as Command | undefined,
    target: undefined as string | undefined,
    file: undefined as string | undefined,
    isPublic: false,
    forceNew: false,
    logout: false,
    help: false,
  };
  const positionals: string[] = [];
  for (const a of argv) {
    if (a === "--public") out.isPublic = true;
    else if (a === "--new") out.forceNew = true;
    else if (a === "--logout") out.logout = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if (!a.startsWith("--")) positionals.push(a);
  }
  // First positional may be a subcommand (delete/public/private) acting on a
  // slug/URL; otherwise it's a file path to upload (the default).
  if (positionals.length > 0 && COMMANDS.has(positionals[0] as Command)) {
    out.command = positionals[0] as Command;
    out.target = positionals[1];
  } else {
    out.file = positionals[0];
  }
  return out;
}

function printHelp() {
  process.stderr.write(
    `pipeit-upload — push docs to pipeit.live and manage them\n\n` +
      `Usage:\n` +
      `  pipeit-upload [--public] [--new] <file>   upload a markdown / text / HTML / PDF file\n` +
      `  pipeit-upload public  <slug|url>          make a doc publicly shareable\n` +
      `  pipeit-upload private <slug|url>          make a doc private\n` +
      `  pipeit-upload delete  <slug|url>          delete a doc you own\n` +
      `  pipeit-upload --logout                    delete the cached token\n\n` +
      `Flags:\n` +
      `  --public   upload as publicly shareable\n` +
      `  --new      force new link (don't update-in-place)\n` +
      `  --logout   delete the cached token\n\n` +
      `You can only manage your own docs. First run opens a browser to authorize.\n` +
      `Token cached at ~/.config/pipeit/token.\n`,
  );
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args.logout) {
    if (existsSync(TOKEN_PATH)) writeFileSync(TOKEN_PATH, "");
    process.stderr.write("logged out\n");
    return;
  }

  if (args.command) {
    if (!args.target) {
      printHelp();
      process.exit(2);
    }
    if (args.command === "delete") {
      const slug = await deleteDoc(args.target);
      process.stdout.write(`deleted ${slug}\n`);
    } else {
      const isPublic = args.command === "public";
      const slug = await setVisibility(args.target, isPublic);
      process.stdout.write(`${slug} is now ${isPublic ? "public" : "private"}\n`);
    }
    return;
  }

  if (!args.file) {
    printHelp();
    process.exit(2);
  }
  const url = await upload(args.file, { isPublic: args.isPublic, forceNew: args.forceNew });
  process.stdout.write(`${url}\n`);
}

// Only run when invoked as the CLI binary — not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  });
}
