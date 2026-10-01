# ThreeLight Kit

**Reusable project configuration modules for assembling and checking a TypeScript, React/Vite, or desktop project by hand.**

[한국어](README.ko.md) · [Module index](#module-boundaries) · [React/Vite walkthrough](#example-assemble-a-reactvite-project)

The configurations are extracted from [StateCarry](https://github.com/ThreeLightStudio/statecarry), with product-specific settings removed. This guide covers the manual workflow documented by the public module READMEs: copy configuration files, merge package snippets, adapt project paths, and run the recipient project's checks. It does not establish npm distribution or a generated application's readiness. No GitHub releases or kit workflow runs were listed at the audited public base.

## Example: assemble a React/Vite project

**Input:** an existing React/Vite app with `index.html`, `src/main.tsx`, a `package.json`, and project-owned tests. Those app entries and tests are supplied by the recipient project; the [React/Vite module](modules/react-vite/README.md) supplies configuration and dependencies.

**Assembly:** select `quality + typescript + react-vite`, then apply each module's public files and snippets manually:

| Module | Copy or merge | Adaptation in a single app |
| --- | --- | --- |
| [quality](modules/quality/README.md) | [Oxfmt](modules/quality/files/.oxfmtrc.json), [Oxlint](modules/quality/files/.oxlintrc.json), [package snippet](modules/quality/package.json.snippet) | Merge scripts and tool versions; review existing settings before replacing them. |
| [typescript](modules/typescript/README.md) | [tsconfig](modules/typescript/files/tsconfig.json), [Vitest config](modules/typescript/files/vitest.config.ts), [package snippet](modules/typescript/package.json.snippet) | Set `@/*` to `./src/*`, Vitest's exact `@` to `./src`, and `include` to the app/test paths. |
| [react-vite](modules/react-vite/README.md) | [Vite config](modules/react-vite/files/vite.config.ts), [package snippet](modules/react-vite/package.json.snippet) | Put the config at the app root; its `@` alias resolves to that root's `src`. |

Merge dependency groups separately and resolve script conflicts deliberately. The quality snippet declares pnpm 10.33.2 and Node ≥24.14.1 as a baseline; adjust the recipient's requirements and CI together.

**Output:** a manually assembled app configuration whose Vite, TypeScript, and Vitest paths agree. Install and check **from the recipient project**, after merging the snippets:

```sh
pnpm install
pnpm run verify
pnpm exec vite build
```

The [quality snippet](modules/quality/package.json.snippet) defines `verify` as formatting → lint → typecheck → tests. Its test command uses `--passWithNoTests`: a green gate without tests is not behavior evidence. Supply relevant project tests. These are documented commands, not a report that this walkthrough was executed.

## Module boundaries

| Module | Owns | Combination or prerequisite |
| --- | --- | --- |
| [quality](modules/quality/) | Formatter/linter settings, quality scripts and tools | Typecheck needs a project tsconfig; normally paired with TypeScript. |
| [typescript](modules/typescript/) | Root tsconfig, Vitest alias resolution | Default web/React assumptions; its Vitest config needs Vitest, supplied by quality. |
| [react-vite](modules/react-vite/) | Vite root, React plugin, source alias, dependencies | App entry files belong to the recipient; normally paired with TypeScript. |
| [git](modules/git/) | Ignore file and GitHub Actions verify template | The workflow requires quality's `verify`; ignore file can stand alone. |
| [workspace](modules/workspace/) | pnpm workspace, Turbo tasks and wrapper | Requires quality; root owns tools, internal packages export source; adjust TypeScript paths. |
| [electrobun](modules/electrobun/) | Desktop shell configuration | Requires React/Vite; baseline targets macOS/Apple Silicon. |
| [agents](modules/agents/) | Agent guidance and decision-record templates | Documentation templates; normally combined with quality. |

## Design choices to inspect

**One concern per module.** Configuration files live under `files/`; package changes are separate snippets; application steps and dependencies stay in each README. This makes manual conflict resolution visible rather than hiding product decisions in a starter. [Quality procedure](modules/quality/README.md) · [React/Vite procedure](modules/react-vite/README.md)

**Agree on source paths across tools.** Vitest derives aliases from TypeScript paths and adds an explicit exact `@` alias; Vite uses its config location as the app root. Align all three when moving from workspace layout to a single app. [TypeScript contract](modules/typescript/README.md) · [Vite config](modules/react-vite/files/vite.config.ts)

**Verification belongs to the assembled project.** Quality provides direct check commands. The optional workspace module replaces selected scripts with a Turbo wrapper and centralizes dependencies; the optional git module provides a workflow template. Those pieces do not prove an arbitrary recipient application works. [Workspace merge rules](modules/workspace/README.md) · [CI template](modules/git/files/verify.yml)

[MIT license](LICENSE)
