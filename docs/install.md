# Installing pipeit

Three paths, same end state: the pipeit Claude Code plugin is registered with its MCP server pointer.

## 1. Claude Code plugin (recommended)

Inside Claude Code:

    /plugin marketplace add repleadfy/pipeit
    /plugin install pipeit@repleadfy

## 2. npm

    npx pipeit.live

## 3. Bun

    bunx pipeit.live

Both `npx` and `bunx` variants either shell out to the `claude` CLI (if present) or print the two `/plugin` lines for you to paste.

## After install

Run `/pipeit` inside Claude Code. Your browser opens once, you sign in (Google / GitHub / email), and the plugin's MCP server receives an access token managed by Claude Code. No credentials are stored on disk outside Claude Code.

## Updates

- Plugin: `/plugin update pipeit`
- CLI: `npx`/`bunx` always fetch the latest published version — no local state.
- Server: transparent — the plugin points at the stable `https://pipeit.live/mcp` URL.

## Uninstall

- Plugin: `/plugin uninstall pipeit`
- Account deletion: `DELETE /api/account`

## Operator notes

- CI requires repository secret `NPM_TOKEN` (publish rights for `pipeit.live`).
- Plugin, CLI, and marketplace versions must stay in lockstep (enforced by the release workflow).

## Deployment troubleshooting

Hard-won gotchas from the first pipeit.live bring-up:

**First deploy: postgres schema is empty.** The kdep postgres statefulset starts with a fresh PVC — the `drizzle/` migrations don't run automatically. Apply them once:

    kubectl -n pipeit exec -i pipeit-postgres-0 -- psql -U pipeit -d pipeit < drizzle/0000_harsh_red_skull.sql

Symptom if you skip it: web pod logs `PostgresError code 42P01` ("relation 'users' does not exist") on any auth request.

**Cloudflare returns 503 for ~60s after ingress create.** That's cert-manager finishing the Let's Encrypt HTTP-01 challenge. Wait and retry — don't start debugging the app. Confirm with:

    kubectl -n pipeit get certificate
    # READY=True means done

**`kdep render` alone produces `:latest`.** The `state.yml` tag isn't merged into the render config — only `kdep bump` picks it up. Symptom: a rollout-restart pulls `ImagePullBackOff` for `leadfycr.azurecr.io/pipeit-web:latest`. Either use `kdep bump web` to keep the tag lineage clean, or patch the deployment image directly:

    kubectl -n pipeit set image deployment/pipeit-web pipeit-web=leadfycr.azurecr.io/pipeit-web:<tag>

**Claude plugin install syntax is `plugin@marketplace-name`, not `plugin@source-path`.** `/plugin marketplace add repleadfy/pipeit` registers the marketplace under its JSON `name` field (`repleadfy`). The install step then uses that name:

    /plugin install pipeit@repleadfy   # correct
    /plugin install pipeit@repleadfy/pipeit   # wrong — "plugin not found"

**Plugin secrets live outside git.** `kdep/web/secrets.yml` and `kdep/postgres/secrets.yml` are gitignored. A global `mpipe → pipeit` rename won't touch them — review those files separately after any product rename, especially `DATABASE_URL` hostname + credentials.
