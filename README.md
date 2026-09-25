# threelight-kit

ThreeLight's reusable project standard suite. A kit so you don't have to set up a new project from scratch every time.

All configuration sources are from [active/statecarry](../active/statecarry), and this repo contains only the universalized versions of those configurations — no project-specific elements. It does not invent new settings — it takes verified values from the original and organizes only what's needed.

## Module Concepts

- **modules/** — independently applicable pieces. Each module covers one concern (formatting, types, quality tools, framework, etc.) and is standalone by default. Dependencies are declared with `requires` in the module README. It contains config files to copy from `files/`, snippets to paste into `package.json`, and manual application steps in the README.
- **presets/** — module combination recipes. "For a React Vite app, use quality + typescript + react-vite" type combinations. (None yet)

## Current Operation: Manual Application

No CLI is provided at this stage. Read the READMEs and apply manually.

1. In a new project, follow each module's README to copy files and reflect snippets in package.json.
2. When you encounter friction or conflicts during application, fix **this kit**, not the project.
3. Verify across 2–3 projects.
4. Then consider CLI-ifying.

In other words, the kit is a product of the iteration/verification phase, and the CLI is the next phase.

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

Presets don't exist yet. Other module (tailwind etc.) combinations will be added in later phases.