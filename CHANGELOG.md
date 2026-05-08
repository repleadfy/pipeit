# Changelog

All notable changes to pipeit are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); pipeit adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `README.md` rewritten for open-source launch (hero, comparison table, roadmap, limits).
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, GitHub issue / PR templates.
- `LICENSE` file (MIT) added at repo root.
- Logo + favicon SVG.

## [0.1.4] - 2026-04-30

### Fixed

- Plugin bin no longer crashes with `SyntaxError: Cannot use import statement outside a module` on Node ≥16. Renamed to `pipeit-upload.mjs` so Node parses it as ESM regardless of enclosing `package.json`.
- Marketplace pin (`.claude-plugin/marketplace.json`) was left at `0.1.3` after the bin fix; bumped to match `plugin.json`.

## [0.1.3] - 2026-04-21

### Added

- `pipeit-upload` CLI binary, bundled with the plugin. Reads files from disk and uploads directly to `/api/docs`, bypassing LLM tokenization. Sub-second uploads up to 1 MB regardless of conversation context.
- Plugin skill routes file-path uploads through the bin; falls back to the MCP tool only when no path is given.

### Changed

- `npm` package `pipeit.live` now ships both `pipeit.live` (installer) and `pipeit-upload` (uploader) bins.

## [0.1.2] - 2026-04-15

### Fixed

- `/plugin install` syntax: marketplace name is `repleadfy`, not the GitHub source path. The installer used `pipeit@repleadfy/pipeit`, which CC rejected as "plugin not found". Now uses `pipeit@repleadfy`.

## [0.1.1] - 2026-04-14

### Changed

- Domain migrated to `pipeit.live` (was `mpipe.dev`). All references updated.
- npm package renamed to `pipeit.live`.

## [0.1.0] - 2026-04-12

### Added

- Initial release.
- `/pipeit` skill in Claude Code: shares the last markdown block from a conversation, or a specific file.
- `pipeit.live` web app: dark/light mode, TOC, syntax highlight, KaTeX, Mermaid, search, reading-progress sync.
- OAuth (Google / GitHub / email) with PKCE.
- Public/private toggle per doc.
- Update-in-place: re-uploading the same file path updates the existing URL with a new version.
- Self-host: kdep manifests for Kubernetes deployments.

[Unreleased]: https://github.com/repleadfy/pipeit/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/repleadfy/pipeit/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/repleadfy/pipeit/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/repleadfy/pipeit/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/repleadfy/pipeit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/repleadfy/pipeit/releases/tag/v0.1.0
