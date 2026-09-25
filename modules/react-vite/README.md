# react-vite module

React + Vite app form module. All values extracted from StateCarry, with project-specific items removed to make a universal version.

Only `vite.config.ts` is included because: app entries (index.html, src/main.tsx) are the project's, and this module provides only the verified config baseline.

## Location-based Point Contract

Both `root` and `alias` are based on `import.meta.dirname`. Therefore, the folder where `vite.config.ts` is placed becomes the app root — whether it's the root of a single project or `apps/<app>/` within a workspace. Moving files moves the reference point with them.

## 3-point Alias Contract

The `@` alias must point to the same target in three places:

1. typescript module tsconfig's `@/*` paths
2. typescript module vitest.config.ts's `'@'` explicit entry
3. This module vite.config.ts's `resolve.alias`

Change all three if you change one. If they mismatch, typecheck/test/build will resolve different module interpretations.

## Included Items

- `files/vite.config.ts` — Root + react plugin + `@` alias baseline
- `package.json.snippet` — react/react-dom + vite series devDependencies snippet (exact StateCarry original version)

## Manual Application Procedure

In the app location (the folder that becomes the app root per the location-based point contract):

1. Copy vite.config.ts
   ```sh
   cp <kit>/modules/react-vite/files/vite.config.ts .
   ```
2. Reflect `package.json.snippet` content in the project's package.json. Merge dependencies and devDependencies separately.
3. Install dependencies
   ```sh
   pnpm install
   ```
4. Verify with build (typecheck series is handled by the typescript module)
   ```sh
   pnpm exec vite build
   ```

## Adjustment Guide

- **Single project**: Keep alias target as `"./src"` (relative to config location). Don't touch `build.outDir` — use vite's default `dist/`.
- **Workspace project**: To export to root `dist/`, add a build block:
  ```ts
  build: { outDir: resolve(import.meta.dirname, '../../dist/web'), emptyOutDir: true },
  ```
- **Dev server options (not in config)**: StateCarry's approach uses `host: '127.0.0.1'` (no external exposure), `strictPort: true`, and `'/api'` proxy when a local API server exists. Port is injected via env from a single source pattern like runtime-config. Apply later if needed by referencing the StateCarry original. This module does not assume a backend, so it is not included in the default config.

## Dependencies

- **No requires** — Can be applied independently. However, since the typescript module's tsconfig assumes `jsx: react-jsx` and DOM lib (React project assumption), the combination with the typescript module is the default.

## Intentionally Excluded

- **Tailwind v4 + shadcn** — Left bare this time. Should be extractable as a separate tailwind module later, so no Tailwind traces remain in this module.
- **Dev server proxy/port** — Per agreement, not included in config; documented as an option in the README adjustment guide only.
- **Product defines 2 and app-version** — `__STATECARRY_VERSION__` (app-version.ts import), `__STATECARRY_DEVELOPER_CONTROLS__` (developer-controls define), runtime-config port are product-specific. Projects needing app version defines add their own way.
- **server block and `command` parameter** — With server and define gone, `command` branching is unnecessary. defineConfig simplified to directly return an object.
- **build block** — Uses vite default `outDir: dist/`. The workspace root dist pattern is documented only as an example in the README adjustment guide.

## StateCarry Original Change History

The original is [active/statecarry](../../../active/statecarry)'s `apps/web/vite.config.ts`.

- Preserved: `root: resolve(import.meta.dirname)`, `react()` in plugins, `'@'` entry in `resolve.alias` — all unchanged from original.
- Removed `@tailwindcss/vite` import and `tailwindcss()` plugin (Tailwind owned by separate tailwind module).
- Removed `APP_VERSION` import and `__STATECARRY_VERSION__` define (product-specific).
- Removed `runtime-config` import and `__STATECARRY_DEVELOPER_CONTROLS__` define (product-specific).
- Removed entire `define` block (both defines above were the only ones).
- Removed entire `server` block (host/strictPort/proxy documented as README options).
- Removed `build` block (workspace root dist pattern documented only as README example).
- Simplified `defineConfig(({ command }) => ({ ... }))` function form to `defineConfig({ ... })` object direct-return form — server and define gone means `command` branching is no longer needed.