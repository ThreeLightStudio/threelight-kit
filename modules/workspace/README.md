# workspace module

Converts a single package.json project to a centralized pnpm workspace model. All values extracted from StateCarry, with project-specific items removed to make a universal version.

## Centralization Model

This module assumes three workspace conventions:

1. All devDependencies are centralized in the root package.json. Internal package package.json files do not contain devDependencies.
2. Internal packages are not built — they export from `exports: "./src/index.ts"` directly.
3. tsconfig is a single root + `paths` for package references. The tsconfig content itself is owned by the typescript module.

## Included Items

- `files/pnpm-workspace.yaml` — Workspace definition
- `files/turbo.json` — Turbo task definition (root tasks 4: format:check, lint, typecheck, test)
- `files/scripts/run-turbo.ts` — Turbo execution wrapper. Handles cache key fingerprint (platform/node/pnpm/git version), strict env mode, and `--fresh` processing.
- `package.json.snippet` — Turbo wrapper scripts + devDependencies snippet

## Manual Application Procedure

1. Copy files
   ```sh
   cp <kit>/modules/workspace/files/pnpm-workspace.yaml .
   cp <kit>/modules/workspace/files/turbo.json .
   mkdir -p scripts
   cp <kit>/modules/workspace/files/scripts/run-turbo.ts scripts/run-turbo.ts
   ```
2. Reflect `package.json.snippet` content in the project's package.json. If quality module is already applied, the merge rules are:
   - Same-name scripts are won by the workspace version (turbo wrapper). `format:check`, `lint`, `typecheck`, `verify` become `tsx scripts/run-turbo.ts task:*` form.
   - `task:*` 4 entries (`task:format:check`, `task:lint`, `task:typecheck`, `task:test`) and `verify:fresh` are added.
   - What remains as direct executables: `format`, `lint:fix`, `test`. `test` is kept as a direct executable to preserve the StateCarry documented contract of `pnpm test <filepath>` focus execution.
3. Adjust the vite environment file list at the top of `scripts/run-turbo.ts` to match project layout.
4. Install dependencies
   ```sh
   pnpm install
   ```
5. Run full gate
   ```sh
   pnpm run verify
   ```

## Dependencies

- **requires: quality** — `task:*` scripts use tools (oxfmt, oxlint, typescript, vitest) provided by the quality module and run scripts. Must be applied with quality.

## When to Apply

- Not applying a PoC or single app is the normal choice. Turbo and run-turbo wrapper shine when tasks run across multiple packages.
- Apply when there are 2+ apps/packages split out.

## Intentionally Excluded

- **Layered package structure** — StateCarry's `packages/*` internal hierarchy is product architecture.
- **check-boundaries, build:artifacts** — Product-specific tasks.
- **What goes in apps/packages** — That is the project's decision. This module only defines the `apps/*`, `packages/*` workspace pattern.

## StateCarry Original Change History

- `pnpm-workspace.yaml`: Original unchanged.
- `turbo.json`: Removed `task:check:boundaries`, `task:build:artifacts` from tasks (product-specific). Changed globalEnv `STATECARRY_TURBO_RUNTIME` to `RUN_TURBO_RUNTIME`. Everything else (CI/LANG/LC_ALL/NODE_ENV/NODE_OPTIONS/TZ, noUpdateNotifier, remoteCache disabled) is unchanged from original.
- `scripts/run-turbo.ts`: Changed env var from `STATECARRY_TURBO_RUNTIME` to `RUN_TURBO_RUNTIME`. Extracted 4 vite environment file paths (`apps/web/.env` etc.) as top-level constants with "adjust to match project layout" comment. All other caching/fingerprint/signal logic is unchanged.
- `package.json.snippet`: Excluded product-specific scripts from StateCarry scripts (`dev`, `check`, `check:boundaries`, `build`, `build:artifacts`, `desktop:*`, `landing:*`, `start`, `verify:connection`, `package:local`). Removed `task:check:boundaries`, `task:build:artifacts` from `verify` / `verify:fresh`. Added only the 4 quality tools, turbo (`2.10.13`, exact pin), and tsx (`^4.20.5`) to devDependencies.