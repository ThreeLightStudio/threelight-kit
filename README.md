# ThreeLight Kit

**Reusable configuration modules and runnable starters for TypeScript, React/Vite, web/API, and macOS desktop projects.**

[Korean manual guide](README.ko.md) · [CLI usage](#cli-usage) · [Module boundaries](#module-boundaries) · [Manual React/Vite walkthrough](#example-assemble-a-reactvite-project)

The configuration baseline was extracted from [StateCarry](https://github.com/ThreeLightStudio/statecarry). The kit keeps those proven settings and adds the entry points, scripts, runtime declarations, and checks needed to turn them into a runnable starter, without copying product-specific behavior.

## Documentation Language

**All documentation, comments, and commit messages in this repository must be written in English.** This applies to README files, module documentation, changelogs, code comments, and any other textual content.

## Versioning

This project follows [Semantic Versioning](https://semver.org/).

- **Initial version** — new projects always start at `0.1.0`.
- **PATCH** (`0.1.z`) — backward-compatible fixes, docs, and chores.
- **MINOR** (`0.y.0`) — new features. While the version is `0.y.z`, breaking changes also bump MINOR and must be called out in the CHANGELOG entry.
- **MAJOR** (`y.0.0`) — reserved for breaking changes after `1.0.0`. Bump to `1.0.0` only when the project is stable enough to promise backward compatibility.

### Version constant

The version lives in exactly one place: the `version` field of the manifest (`package.json`). Never hardcode version strings in source files or docs — when code needs the version, read it from the manifest through a single constant module (e.g. `app-version.ts` re-exporting `APP_VERSION`) or compile-time injection (pattern proven in [StateCarry](https://github.com/ThreeLightStudio/statecarry)). In pnpm workspaces, workspace package versions stay independent of the release version.

### Cutting a release

1. Bump `version` in `package.json`.
2. Rename `[Unreleased]` in `CHANGELOG.md` to `[X.Y.Z] - YYYY-MM-DD`, then start a fresh `[Unreleased]` section.
3. Commit the bump as a version-only release commit (no unrelated changes), create the `vX.Y.Z` tag, and push it.

`package.json`, the latest `CHANGELOG.md` entry, and the latest git tag must always carry the same version.

## Module Concepts

- **modules/** — independently applicable configuration pieces. Dependencies are declared in `module.json`, with config files in `files/`, package contributions in `package.json.snippet`, and manual application instructions in the README.
- **presets/** — module combination recipes. "For a React Vite app, use quality + typescript + react-vite" type combinations.
- **templates/** and **runtimes/** — runnable project files and the runtime source used by creation and generated CI. See the [metadata contract](docs/metadata.md).
- **kit** — the CLI. Creates runnable projects or applies configuration modules, resolves dependencies recursively, then installs and verifies.

## CLI Usage

Create a runnable project from the parent directory:

```sh
# from this repo (or after linking the package)
node /path/to/threelight-kit/kit list
node /path/to/threelight-kit/kit create react-vite ./my-app --dry-run
node /path/to/threelight-kit/kit create react-vite ./my-app
cd my-app
npm exec --yes --package=pnpm@10.33.2 -- pnpm run dev
```

`create` prints the matching development command from the runtime declaration. The pinned command runs without changing the global pnpm installation.

- `kit create react-vite <directory> [--name <name>] [--dry-run]` — creates a single-package React app with source, a real rendering test, development/build/preview scripts, quality checks, CI, and agent guidance. Installation, initial formatting, and verification run automatically. New project versions start at `0.1.0`.
- `kit create node-ts <directory>` — creates an ESM Node TypeScript project with NodeNext resolution, watch development, compiled output, and real tests. It has no React or Vite dependencies.
- `kit create web-api <directory>` — creates a React/Vite and Node HTTP API workspace with shared contracts and environment settings. Development waits for the API, starts the web app, and stops both owned servers together. The compiled server serves the production web build.
- `kit create desktop-react <directory>` — creates an unsigned Electrobun/Cottontail React desktop app for macOS Apple Silicon. Creation verifies the native build; `pnpm dev` opens a native window with build watching, and `pnpm preview` runs the development bundle. Release signing and distribution are outside this starter.
- `kit list` — distinguishes runnable presets from configuration presets and lists module dependencies.
- `kit init <preset|module>` — applies the target and its dependencies in the current project: copies config files, merges `package.json` snippets, runs `pnpm install`, then runs `pnpm run format` and `pnpm run verify` when the applied modules provide those scripts (they come from the quality module).

`create` accepts a missing or empty directory, or a directory containing only `.git`. It rejects symlink destinations and ancestors and never overwrites an existing project. Package names are unscoped lowercase npm names; use `--name` when the directory name is unsuitable. A dry run lists the planned files, configuration, and commands without writing files or installing packages.

Creation supports Node 24 at or above the minimum declared in `runtimes/node24.json`. The same declaration generates `.node-version`, manifest `engines`/`packageManager`, and CI. If the global pnpm version differs, the CLI executes the declared pnpm through npm without changing the global installation. Installation or verification failure preserves the generated project and prints recovery commands.

Desktop creation also checks macOS, ARM64, and `tar` before writing. Its matching runtime declaration selects the ARM64 macOS CI runner. Electrobun downloads its pinned Hutch/Cottontail SDK automatically; the unsigned development path does not require a separate Bun or compiler installation.

`init` remains configuration-only: it uses the existing workspace-shaped TypeScript profile and does not create app entry points. It retains its existing file replacement and package merge behavior, so review an existing project's changes carefully. `kit init <preset|module> --dry-run` previews the changes without writing or running commands.
`node-ts` and `web-api` are creation-only presets; use `create` for their runtime-specific settings. Existing React and desktop configuration application remains available.

Manual application (following each module's README) is still supported, but the CLI is the intended path.

## Smoke Tests

The test suites use isolated temporary directories and do not modify real projects:

Run creation checks with the supported Node 24 runtime. If the default Node differs,
set `KIT_CREATE_TEST_NODE` to the absolute path of the supported Node executable.

```sh
npm test                 # legacy configuration flow + new creation/error-path tests
npm run test:smoke        # fast tier: usage, list, error paths, and the init flow with a stubbed pnpm (no network)
npm run test:smoke:full   # also runs a real `kit init react-vite` with a real pnpm install + verify
npm run test:create:full  # packed CLI, two real projects, dev/preview, frozen install, and failing-check probes
npm run test:p1           # portable metadata, composition, runtime, and startup failure checks
npm run test:p1:full      # packed CLI, real Node/web-API installation, builds, execution, and process cleanup
npm run test:p1:desktop   # full P1 checks plus actual native build on macOS Apple Silicon
```

Each test runs in its own temp directory, removed afterwards. The fast tier puts a fake `pnpm` on `PATH` that records the commands the CLI invokes, so it verifies file copying, `package.json` merging, dependency resolution, and command sequencing without installing anything.

The npm-packed CLI was verified locally in independent generated projects: React, Node TypeScript, web/API, and an unsigned macOS ARM64 desktop app. Installation, tests, and builds succeeded without configuration edits. Browser checks covered web/API development and production serving; native window and source-watching checks covered the desktop app. Hosted GitHub CI and npm publication are separate from this local evidence.

## Current Operation: Iteration & Verification

The CLI exists in an initial form and is the primary application path. The kit is still in its iteration/verification phase:

1. Run `kit create react-vite <directory>` for a runnable app, or `kit init <preset|module>` for configuration-only application.
2. When you encounter friction or conflicts during application, fix **this kit**, not the project.
3. Verify across 2–3 projects before extending the CLI further.

## Example: assemble a React/Vite project

This section applies configuration modules to an existing app. For a new app with entry points and tests, use `kit create react-vite <directory>`.

**Input:** an existing React/Vite app with `index.html`, `src/main.tsx`, a `package.json`, and project-owned tests. Those app entries and tests are supplied by the recipient project; the [React/Vite module](modules/react-vite/README.md) supplies configuration and dependencies.

**Assembly:** select `quality + typescript + react-vite`, then apply each module's public files and snippets manually:

| Module                                     | Copy or merge                                                                                                                                                              | Adaptation in a single app                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [quality](modules/quality/README.md)       | [Oxfmt](modules/quality/files/.oxfmtrc.json), [Oxlint](modules/quality/files/.oxlintrc.json), [package snippet](modules/quality/package.json.snippet)                      | Merge scripts and tool versions; review existing settings before replacing them.            |
| [typescript](modules/typescript/README.md) | [tsconfig](modules/typescript/files/tsconfig.json), [Vitest config](modules/typescript/files/vitest.config.ts), [package snippet](modules/typescript/package.json.snippet) | Set `@/*` to `./src/*`, Vitest's exact `@` to `./src`, and `include` to the app/test paths. |
| [react-vite](modules/react-vite/README.md) | [Vite config](modules/react-vite/files/vite.config.ts), [package snippet](modules/react-vite/package.json.snippet)                                                         | Put the config at the app root; its `@` alias resolves to that root's `src`.                |

Merge dependency groups separately and resolve script conflicts deliberately. The quality snippet declares pnpm 10.33.2 and Node ≥24.14.1 as a baseline; adjust the recipient's requirements and CI together.

**Output:** a manually assembled app configuration whose Vite, TypeScript, and Vitest paths agree. Install and check **from the recipient project**, after merging the snippets:

```sh
pnpm install
pnpm run verify
pnpm exec vite build
```

The [quality snippet](modules/quality/package.json.snippet) defines `verify` as formatting → lint → typecheck → tests. Its test command uses `--passWithNoTests`: a green gate without tests is not behavior evidence. Supply relevant project tests. These manual adaptation steps are separate from the tested creation templates.

## Module boundaries

| Module                            | Owns                                                 | Combination or prerequisite                                                                  |
| --------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [quality](modules/quality/)       | Formatter/linter settings, quality scripts and tools | Typecheck needs a project tsconfig; normally paired with TypeScript.                         |
| [typescript](modules/typescript/) | Root tsconfig, Vitest alias resolution               | Default web/React assumptions; its Vitest config needs Vitest, supplied by quality.          |
| [react-vite](modules/react-vite/) | Vite root, React plugin, source alias, dependencies  | App entry files belong to the recipient; normally paired with TypeScript.                    |
| [git](modules/git/)               | Ignore file and GitHub Actions verify template       | The workflow requires quality's `verify`; ignore file can stand alone.                       |
| [workspace](modules/workspace/)   | pnpm workspace, Turbo tasks and wrapper              | Requires quality; root owns tools, internal packages export source; adjust TypeScript paths. |
| [electrobun](modules/electrobun/) | Desktop shell configuration                          | Requires React/Vite; baseline targets macOS/Apple Silicon.                                   |
| [agents](modules/agents/)         | Agent guidance and decision-record templates         | Documentation templates; normally combined with quality.                                     |

## Currently Available Presets

| Preset                                      | Creation layout                                | Configuration application                      |
| ------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| [react-vite](presets/react-vite.json)       | Single-package React/Vite                      | quality + typescript + react-vite              |
| [node-ts](presets/node-ts.json)             | Single-package Node TypeScript                 | Creation only                                  |
| [web-api](presets/web-api.json)             | React/Vite + Node API workspace                | Creation only                                  |
| [desktop-react](presets/desktop-react.json) | Native desktop + React workspace (macOS ARM64) | quality + typescript + react-vite + electrobun |

More module combinations (tailwind etc.) will be added in later phases.

All runnable presets include Git/CI settings, agent guidance, and a verification pipeline that checks formatting, lint, types, collected tests, and the actual build. Creation templates declare their file replacements explicitly and reuse the configuration modules where their contracts match.

## Design choices to inspect

**One concern per module.** Configuration files live under `files/`; package changes are separate snippets; module dependencies are declared in `module.json`, and the READMEs explain application. This keeps configuration conflicts visible during manual application. [Quality procedure](modules/quality/README.md) · [React/Vite procedure](modules/react-vite/README.md)

**Agree on source paths across tools.** Vitest derives aliases from TypeScript paths and adds an explicit exact `@` alias; Vite uses its config location as the app root. Align all three when moving from workspace layout to a single app. [TypeScript contract](modules/typescript/README.md) · [Vite config](modules/react-vite/files/vite.config.ts)

**Verification belongs to the assembled project.** Quality provides direct check commands. The optional workspace module replaces selected scripts with a Turbo wrapper and centralizes dependencies; the optional git module provides a workflow template. Runnable presets add real tests and build verification; recipient projects still need tests for their own behavior. [Workspace merge rules](modules/workspace/README.md) · [CI template](modules/git/files/.github/workflows/verify.yml)

## Expansion Priorities

The React, Node TypeScript, web/API, and macOS ARM64 desktop starters form the current runnable baseline. Deployment modules, broader environment validation, architecture boundaries, and documentation automation are the next optional extensions. Expo, Godot, Python, and package publishing follow when their native setup and verification can be tested independently. Existing project migration and managed updates are outside this iteration.

[MIT license](LICENSE)
