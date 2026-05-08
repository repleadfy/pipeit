# Security Policy

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub Security Advisories instead:

→ https://github.com/repleadfy/pipeit/security/advisories/new

You'll get a private channel with the maintainers. We'll acknowledge within 48 hours and target 7 days for a fix on anything high or critical.

## Scope

In scope:

- The `pipeit.live` web app (`packages/web`) and API (`packages/server`)
- The MCP server (`packages/mcp`) — auth flow, token handling, OAuth state
- The CLI binaries (`packages/cli`, `plugins/pipeit/bin`) — token storage, file handling
- The auth flow specifically: PKCE, OAuth state, session cookies, token expiry

Out of scope:

- Rate limiting documented in [README.md](README.md#limits) is *expected behavior* up to those thresholds. Reports of "I can hit the rate limit" aren't vulnerabilities.
- DoS via crafted markdown that's slow to render (we'll fix it as a bug, but it isn't a security issue).
- Self-hosted deployments with non-default configs (e.g. disabled rate limiting) — fix your config.
- Vulnerabilities in third-party dependencies that we already track via Dependabot.

## What counts

We treat as security issues:

- Auth bypass, privilege escalation, IDOR
- Token leakage (in logs, URLs, headers, error messages)
- XSS / CSRF / clickjacking on `pipeit.live`
- SSRF, server-side template injection, SQL injection
- RCE on the server or in any CLI binary
- Bugs that allow reading another user's private docs

## Credit

We'll credit reporters of valid issues in the release notes (or at your request, anonymously). pipeit doesn't run a paid bounty program.
