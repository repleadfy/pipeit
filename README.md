# pipeit

Share markdown from AI conversations. Read on any device.

## Install

The fastest path is the Claude Code plugin:

    /plugin marketplace add repleadfy/pipeit
    /plugin install pipeit

Or from a terminal:

    npx pipeit   # or: bunx pipeit

Full install reference: [docs/install.md](docs/install.md).

## Usage

Inside Claude Code:

    /pipeit                        # share the last markdown block from this conversation
    /pipeit ./path/to/file.md      # share a specific file
    /pipeit --new ./file.md        # force new link (snapshot)
    /pipeit --public ./file.md     # make the doc publicly shareable

On first run, your browser opens once for sign-in; after that, Claude Code owns the MCP access token.
