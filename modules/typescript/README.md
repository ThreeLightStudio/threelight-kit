# typescript module

TypeScript compile baseline. All values extracted from StateCarry, with project-specific items removed to make a universal version.

Quality module's `typecheck` script (`tsc --noEmit`) consumes this tsconfig, and this module implements the workspace module's centralization convention (single root tsconfig + `paths` for package references).

## tsconfig and vitest Contract

`files/vitest.config.ts`'s role is to ensure that `typecheck` (`tsc`) and `test` (`vitest`) see **the same source and the same aliases**. Vitest reads `tsconfig.json`'s `compilerOptions.paths` and drives resolve aliases accordingly. That means the single source of truth for aliases is tsconfig, and changing paths will change test module resolution too.

One exception: `@/*` matches by pattern only and does not catch exact `@` imports, so vitest config has a separate `'@'` explicit entry. When changing the target path for `@/*`, this explicit entry must be changed too.

`fileParallelism: false` is a conservative default for sequential test execution. This ensures tests don't compete for resources (DB, port, filesystem), and parallelization can be deliberately reverted by the project if needed.

## Included Items

- `files/tsconfig.json` — Single root tsconfig (compilerOptions + paths + include)
- `files/vitest.config.ts` — tsconfig paths-based alias + vitest test settings
- `package.json.snippet` — devDependencies snippet

## Manual Application Procedure

From the project root:

1. Copy files
   ```sh
   cp <kit>/modules/typescript/files/tsconfig.json .
   cp <kit>/modules/typescript/files/vitest.config.ts .
   ```
2. Reflect `package.json.snippet` content in the project's package.json. If quality module is already applied, `typescript ^5.9.2` is already included, so only add `@types/node ^24.3.0`.
3. Adjust paths and include to match project layout per the adjustment guide below.
4. Install and verify
   ```sh
   pnpm install
   pnpm run typecheck
   ```

## Adjustment Guide

- **Single project**: Change `@/*` path to `"./src/*"` (vitest config's `'@'` explicit entry should also be `"./src"`). Adjust `include` to match project layout (e.g., `["src", "tests", "vitest.config.ts"]`).
- **Workspace project**: Add paths entries for each internal package. Form: `"@scope/pkg": ["./packages/pkg/src/index.ts"]` (points directly to source index.ts — follows the "export from source without building" centralization convention). Keep default `include` (`packages`, `apps`, `scripts`, `tests`).
- **Non-React project**: Remove the `jsx` option.
- **Node-only project**: Remove `DOM` and `DOM.Iterable` from `lib`.

This baseline is web/React-first, which is why DOM lib and react-jsx are included by default.

## Dependencies

- **No requires** — Can be applied independently. However, since quality module's `typecheck` script and vitest alias driving both use this module's files, it only makes full sense with quality. Without a tsconfig, quality's `typecheck` fails.
- **Reverse coupling**: tsconfig's `include` includes `vitest.config.ts`, so `typecheck` (`tsc --noEmit`) inspects `vitest.config.ts`, which imports `vitest/config`, meaning vitest must be installed. Thus the quality + typescript combination is the default combination.

## Intentionally Excluded

- **app-version.ts / `__STATECARRY_VERSION__` define** — Injecting app version at build time is a product-specific concern. Projects needing version defines add their own way.
- **Product naming in paths** — `@statecarry/*` package references were removed. Only `@/*` generic alias pattern is left as an example.

## StateCarry Original Change History

- `tsconfig.json`: Removed 3 entries (`@statecarry/contracts`, `@statecarry/core`, `@statecarry/presentation`) from paths (product naming). `@/*` entry and all compilerOptions, `include` remain unchanged from original.
- `vitest.config.ts`: Removed `app-version.ts` import and `__STATECARRY_VERSION__` define (product-specific). paths→alias driving logic, `'@'` explicit entry, tests include pattern, `fileParallelism: false` remain unchanged from original.

### `allowImportingTsExtensions` (for React/Vite projects)

Vite allows importing `.tsx` files without extensions, but TypeScript's default setting (`moduleResolution: "Bundler"`) does not allow omitting extensions. If your project wants to use `.tsx` imports without extensions, add the following to `tsconfig.json`:

```json
"allowImportingTsExtensions": true
```

> **Note:** This option is only valid when both `"noEmit": true` and `"moduleResolution": "Bundler"` are enabled. The kit's default tsconfig satisfies both conditions, so it can be safely enabled.