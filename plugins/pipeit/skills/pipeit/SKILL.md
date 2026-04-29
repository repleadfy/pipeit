---
name: pipeit
description: Pipe markdown from your conversation to pipeit.live for reading on any device. Use when the user says "/pipeit", wants to share a markdown file, or asks to send a doc to their phone/browser.
---

## Usage

```
/pipeit                        → share the last markdown block from this conversation
/pipeit ./path/to/file.md      → share a specific file
/pipeit --new ./file.md        → force new link (snapshot)
/pipeit --public ./file.md     → make the doc publicly shareable
```

## Behavior

### A. File path provided → use the `pipeit-upload` CLI via Bash

Always prefer this path when a file path is given. The CLI reads the file from disk and uploads it directly, so the content never has to be re-tokenized by the LLM. Works for files of any size in under a second.

Run via Bash — the script is bundled with this plugin:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/pipeit-upload.mjs" [--public] [--new] <path>
```

The command prints the URL to stdout. Echo it back to the user:

```
✓ Piped to https://pipeit.live/d/a8f3k2x9
```

First run opens a browser for a one-time authorization; the token is cached at `~/.config/pipeit/token`. Subsequent runs are token-cached and upload directly.

**Fallback:** if for any reason the bin can't run (e.g. `node` missing), fall back to the MCP tool (next section) — but warn the user that large files will be slow because content must be passed through LLM tokens.

### B. No file path → use the `pipeit_upload` MCP tool

Extract the last significant markdown block from the conversation and call the MCP tool:

```json
{
  "content": "<markdown content>",
  "is_public": false
}
```

Flags:
- `--new` — omit `file_path` (always true in this branch anyway).
- `--public` — set `is_public: true`.

The tool returns the URL. Print it.

## Optional Slack share

After upload, if Slack MCP tools are available (`slack_send_message`), ask:

> "Want to share this on Slack? Which channel?"

If yes, call `slack_send_message` with the URL.
