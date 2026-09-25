# threelight-kit

ThreeLight's reusable project standard suite. A kit so you don't have to set up a new project from scratch every time.

All configuration sources are from [active/statecarry](../active/statecarry), and this repo contains only the universalized versions of those configurations — no project-specific elements. It does not invent new settings — it takes verified values from the original and organizes only what's needed.

## Documentation Language

**All documentation, comments, and commit messages in this repository must be written in English.** This applies to README files, module documentation, changelogs, code comments, and any other textual content.

## Module Concepts

- **modules/** — independently applicable pieces. Each module covers one concern (formatting, types, quality tools, framework, etc.) and is standalone by default. Dependencies are declared with `requires` in the module README. It contains config files to copy from `files/`, snippets to paste into `package.json`, and manual application steps in the README.
- **presets/** — module combination recipes. "For a React Vite app, use quality + typescript + react-vite" type combinations.
- **kit** — the CLI. Applies modules and presets automatically: copies `files/`, merges `package.json` snippets, resolves module dependencies, then installs and verifies.

## CLI Usage

From the root of a new project:

```sh
# from this repo (or after linking the package)
node /path/to/threelight-kit/kit list
node /path/to/threelight-kit/kit init <preset|module>
```

- `kit list` — shows available presets and modules (with their `requires` dependencies).
- `kit init <preset|module>` — applies the target and its dependencies in the current project: copies config files, merges `package.json` snippets, runs `pnpm install`, then runs `pnpm run format` and `pnpm run verify` when the applied modules provide those scripts (they come from the quality module).

Manual application (following each module's README) is still supported, but the CLI is the intended path.

## Smoke Tests

`tests/smoke.js` exercises the CLI end to end without touching a real project:

```sh
npm run test:smoke        # fast tier: usage, list, error paths, and the init flow with a stubbed pnpm (no network)
npm run test:smoke:full   # also runs a real `kit init react-vite` with a real pnpm install + verify
```

Each test runs in its own temp directory, removed afterwards. The fast tier puts a fake `pnpm` on `PATH` that records the commands the CLI invokes, so it verifies file copying, `package.json` merging, dependency resolution, and command sequencing without installing anything.

## Current Operation: Iteration & Verification

The CLI exists in an initial form and is the primary application path. The kit is still in its iteration/verification phase:

1. In a new project, run `kit init <preset|module>`.
2. When you encounter friction or conflicts during application, fix **this kit**, not the project.
3. Verify across 2–3 projects before extending the CLI further.

## Currently Available Modules

| Module | Description |
| --- | --- |
| [quality](modules/quality/) | Quality toolset based on oxfmt + oxlint + typescript + vitest |
| [git](modules/git/) | GitHub Actions verify workflow + universal .gitignore (moved from quality) |
| [workspace](modules/workspace/) | Convert single package.json project to centralized pnpm workspace model. Requires: quality |
| [typescript](modules/typescript/) | TypeScript compile baseline (single root tsconfig + dynamic vitest alias). Quality's typecheck consumes this tsconfig |
| [react-vite](modules/react-vite/) | React + Vite app form. Vite config baseline (root/alias based on file location). Default combination with typescript module |
| [electrobun](modules/electrobun/) | Electrobun desktop shell config baseline (macOS/Apple Silicon). Requires: react-vite |
| [agents](modules/agents/) | Agent operational guidance layer — AGENTS.md template + ADR template. Documentation template only (no snippet). Default combination with quality |

## Currently Available Presets

| Preset | Modules |
| --- | --- |
| [react-vite](presets/react-vite.json) | quality + typescript + react-vite |
| [desktop-react](presets/desktop-react.json) | quality + typescript + react-vite + electrobun |

More module combinations (tailwind etc.) will be added in later phases.