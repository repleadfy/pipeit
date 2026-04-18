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

1. **Determine content:**
   - If a file path is provided, read that file
   - If no path, extract the last significant markdown block from the conversation

2. **Upload via MCP:**
   Call the `pipeit_upload` MCP tool:
   ```json
   {
     "content": "<markdown content>",
     "file_path": "<original path or null>",
     "is_public": false
   }
   ```
   - If `--new` flag: omit `file_path` to force a new document
   - If `--public` flag: set `is_public: true`

3. **Return the link:**
   Print the URL returned by the tool. Example:
   ```
   ✓ Piped to https://pipeit.live/d/a8f3k2x9
   ```

4. **Optional Slack share:**
   If Slack MCP tools are available (check for `slack_send_message`), ask:
   > "Want to share this on Slack? Which channel?"
   If yes, call `slack_send_message` with the URL.
