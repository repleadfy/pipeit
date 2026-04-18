# Installing mpipe

Three paths, same end state: the mpipe Claude Code plugin is registered with its MCP server pointer.

## 1. Claude Code plugin (recommended)

Inside Claude Code:

    /plugin marketplace add repleadfy/mpipe
    /plugin install mpipe

## 2. npm

    npx mpipe.dev

## 3. Bun

    bunx mpipe.dev

Both `npx` and `bunx` variants either shell out to the `claude` CLI (if present) or print the two `/plugin` lines for you to paste.

## After install

Run `/mpipe` inside Claude Code. Your browser opens once, you sign in (Google / GitHub / email), and the plugin's MCP server receives an access token managed by Claude Code. No credentials are stored on disk outside Claude Code.

## Updates

- Plugin: `/plugin update mpipe`
- CLI: `npx`/`bunx` always fetch the latest published version — no local state.
- Server: transparent — the plugin points at the stable `https://mpipe.dev/mcp` URL.

## Uninstall

- Plugin: `/plugin uninstall mpipe`
- Account deletion: `DELETE /api/account`

## Operator notes

- CI requires repository secret `NPM_TOKEN` (publish rights for `mpipe.dev`).
- Plugin, CLI, and marketplace versions must stay in lockstep (enforced by the release workflow).
