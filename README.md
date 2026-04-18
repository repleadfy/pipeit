# mpipe

Share markdown from AI conversations. Read on any device.

## Install

The fastest path is the Claude Code plugin:

    /plugin marketplace add repleadfy/mpipe
    /plugin install mpipe

Or from a terminal:

    npx mpipe.dev   # or: bunx mpipe.dev

Full install reference: [docs/install.md](docs/install.md).

## Usage

Inside Claude Code:

    /mpipe                        # share the last markdown block from this conversation
    /mpipe ./path/to/file.md      # share a specific file
    /mpipe --new ./file.md        # force new link (snapshot)
    /mpipe --public ./file.md     # make the doc publicly shareable

On first run, your browser opens once for sign-in; after that, Claude Code owns the MCP access token.
