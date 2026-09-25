# quality module

Quality toolset based on oxfmt + oxlint + typescript + vitest. All values extracted from StateCarry, with project-specific items removed to make a universal version.

## Philosophy

- All categories off + error-only minimum rules: Keep the linter as "a tool that catches only team-agreed certainties". Pedantic rule additions are promoted one at a time as the project grows.
- Exact pin for tool versions: Since oxfmt/oxlint minor/patch changes directly affect output, pin them without `^`.
- Run the entire gate with a single `pnpm run verify`.

## Included Items

- `files/.oxfmtrc.json` — oxfmt settings
- `files/.oxlintrc.json` — oxlint settings
- `package.json.snippet` — scripts + devDependencies + packageManager/engines snippet

## Manual Application Procedure

From the project root:

1. Copy config files
   ```sh
   cp <kit>/modules/quality/files/.oxfmtrc.json .
   cp <kit>/modules/quality/files/.oxlintrc.json .
   ```
   If an existing file is present, merge it (diff before overwriting). .gitignore is owned by the git module, so follow that procedure.
2. Reflect `package.json.snippet` content in the project's package.json. Adjust conflicting scripts only, and merge devDependencies.
3. Install dependencies
   ```sh
   pnpm install
   ```
4. Run full gate
   ```sh
   pnpm run verify
   ```

Without applying the typescript module, only `format:check` and `lint` work properly — `typecheck` fails without a tsconfig, and `test` fails without test files.

## Version Pinning Convention

- `packageManager: pnpm@10.33.2` — Pins pnpm version so the whole team/CI uses the same lockfile format.
- `engines.node: ">=24.14.1"` — Example value. Adjust to project requirements. The key convention is that node version is explicitly declared.
- oxfmt `0.68.0`, oxlint `1.83.0` — exact pin (StateCarry convention). Upgrades are made via deliberate commits.
- typescript `^5.9.2`, vitest `^3.2.4` — caret allowed.

## Intentionally Excluded

- **`task:*` prefix and turbo wrapper (`scripts/run-turbo.ts`)** — StateCarry's `format:check`, `lint`, `typecheck`, `verify` use `tsx scripts/run-turbo.ts task:*` turbo task wrapper. This belongs to the workspace/monorepo module, so it is not included in quality. Instead, scripts are changed to direct executable commands (`oxfmt --check .`, `oxlint .`, `tsc --noEmit`, `vitest run`) and `verify` is restructured as an `&&` chain. The turbo wrapper role is now handled by the [workspace module](../workspace/).
- **tsconfig** — Owned by the typescript module. Quality only provides the `typecheck` script (`tsc --noEmit`) and does not touch tsconfig contents.
- **StateCarry project-specific items** — All product architecture (packages/* structure, check-boundaries, `task:build:artifacts` etc.) and ignorePatterns `.statecarry/**`. Note `.turbo/**` remains in ignores. For single projects not using turbo, it is harmless and can be cleaned up later.
- **`node_modules/**` from oxlint ignorePatterns** — Default .oxlintrc.json does not include `node_modules/**` in ignorePatterns. If the config file is not copied to a new project, `oxlint` will scan `node_modules` and report numerous warnings/errors. Always verify the `.oxlintrc.json` was copied after applying this module.

## StateCarry Original Change History

- `.oxfmtrc.json` / `.oxlintrc.json`: Removed `.statecarry/**` from ignorePatterns. `.hutch/**`, `.cottontail-tmp/**` were removed then restored as tool artifacts when the electrobun module was added (hutch holds JSON/TS files that formatters/linters should not touch). Everything else (all categories off, error-only rules 7, `reportUnusedDisableDirectives`, full formatting options) remains unchanged from the original.
- `.gitignore`: Moved without content changes to the git module. .gitignore is now owned by the git module; StateCarry original change history is documented in the git module README. SQLite entry (`*.sqlite*`, `*.db`, `*.db-wal`, `*.db-shm`) retention is a deliberate decision.
- `package.json.snippet`: Turbo wrapper scripts replaced with direct executables, `verify` restructured with `&&` chain. Only includes the 4 quality tools, excluding workspace deps, react/vite/electrobun etc.