# electrobun module

Electrobun desktop shell config baseline. All values were extracted from StateCarry, with project-specific items replaced by placeholders to make a universal version. The distribution scope is the same as StateCarry (macOS/Apple Silicon) (see StateCarry `docs/decisions/0001-electrobun.md`).

App entries (`apps/desktop/src/main.ts` etc. main process code) are the project's, and this module only provides the config. The config points to entries the project must write directly — copying only this module's files will not produce a build.

## Structural Contracts

**Channel convention (dev/stable → cacheRoot).** The single source for channel branching is `build-profile.ts`'s `desktopBuildProfile()`, but the resulting channel convention (`.cache/electrobun` vs `.cache/electrobun/dev`) is duplicated in both `electrobun.config.ts` and `build-web.mjs`. When changing the channel convention, change both files together.

**Identifier 4-point contract.** The stable identifier must be the same value in four places:

1. `build-profile.ts` — `desktopBuildProfile()` stable identifier literal
2. `build-profile.ts` — dev identifier literal (`stable` + `.dev`)
3. `build-profile.ts` — `desktopRuntimeEnvironment()` stable identifier literal
4. `electrobun.config.ts` — comparison literal used in stable determination

Change all four if you change one. If they mismatch, stable determination fails and builds will go to the dev cache/update feed path instead.

## Must-Replace Project Values

| Value | Location | Default |
| --- | --- | --- |
| Identifier | 4-point contract above | `com.example.myapp` (dev: `.dev` suffix) |
| App Name | `build-profile.ts` | `MyApp` (dev: `MyApp Dev`) |
| Copy Destination | `electrobun.config.ts` | `views/myapp` |
| release.baseUrl | `electrobun.config.ts` | `https://github.com/example/myapp/releases/latest/download` |

`release.baseUrl` is the stable channel's auto-update feed. If not using auto-update, leave it as `''`.

## Included Items

- `files/electrobun.config.ts` — Electrobun build/deploy settings (mac codesign/notarize/createDmg, copy, release, runtime, preBuild)
- `files/hutch.config.ts` — hutch toolchain config (electrobun version, packageManager, hutch scripts)
- `files/apps/desktop/build-profile.ts` — Channel (env) → app name/identifier profile and runtime environment determination
- `files/apps/desktop/scripts/build-web.mjs` — Pre-build script that runs vite build and outputs results to `web/` in cacheRoot
- `package.json.snippet` — Desktop scripts + electrobun devDependency snippet

## Manual Application Procedure

From the project root:

1. Copy files
   ```sh
   mkdir -p apps/desktop/scripts
   cp <kit>/modules/electrobun/files/electrobun.config.ts .
   cp <kit>/modules/electrobun/files/hutch.config.ts .
   cp <kit>/modules/electrobun/files/apps/desktop/build-profile.ts apps/desktop/build-profile.ts
   cp <kit>/modules/electrobun/files/apps/desktop/scripts/build-web.mjs apps/desktop/scripts/build-web.mjs
   ```
2. Replace identifier, app name, copy destination, and release.baseUrl with project values per the "Must-Replace Project Values" table above. For a single project, also adjust the vite config path constant at the top of `build-web.mjs` to match your layout.
3. Reflect `package.json.snippet` content in the project's package.json. Add scripts, merge devDependencies.
4. Install dependencies
   ```sh
   pnpm install
   ```
5. Verify with prepare
   ```sh
   pnpm desktop:prepare
   ```

## Dependencies

- **requires: react-vite** — `build-web.mjs` runs vite build to output to cacheRoot, and `electrobun.config.ts`'s `copy` relays it to `views/`. This is StateCarry's verified combination.
- The default layout (`apps/web`, `apps/desktop`) works well with the workspace module, but is not a requirement. For a single project, only the `build-web.mjs` path constant needs adjustment.
- Projects using the git module should change the CI runner to `macos-15` (see the git module `verify.yml` comment).

## Reference: codesign/notarize Credentials

`mac: { codesign: true, notarize: true }` requires Apple Developer credentials. Keep credentials outside the repo (StateCarry AGENTS.md convention — maintain local release env file and Apple `.p8` key outside the repository). The procedure to source credentials locally before stable builds is the project's responsibility.

## Intentionally Excluded

- **`apps/desktop/src` product code** — main process entry (`main.ts`), updater, folder-picker, etc. are product code. Written by the project, pointed to by the config's `cottontail.entrypoint`.
- **`desktop:dev` launcher** — StateCarry's `scripts/desktop-dev.ts` (launcher that runs web dev server and electrobun dev together) was not extracted this time. If needed, reference the StateCarry original to extract later. `desktop:dev` also exists in hutch.config.ts's hutch scripts, so it intentionally only appears in package.json.snippet.
- **Auto-update infrastructure details** — Only `release.baseUrl` feed address remains; update server configuration/release procedure is not covered.

## StateCarry Original Change History

- `hutch.config.ts`: Original unchanged.
- `electrobun.config.ts`: Replaced `import { APP_VERSION } from './app-version'` with `import packageJson from './package.json'` and `version: APP_VERSION` with `version: packageJson.version` (deliberate choice for consistency with typescript module excluding app-version.ts as product-specific; supported by typescript module tsconfig's `resolveJsonModule: true`). Changed stable comparison literal from `com.threelightstudio.statecarry` to `com.example.myapp`, copy destination from `views/statecarry` to `views/myapp`, and release.baseUrl GitHub URL to `https://github.com/example/myapp/releases/latest/download`. Everything else (full structure, mac codesign/notarize/createDmg, generatePatch, runtime, scripts.preBuild paths, cacheRoot channel branching logic) remains the same.
- `apps/desktop/build-profile.ts`: Changed env var from `STATECARRY_DESKTOP_ENV` to `DESKTOP_ENV` (including error messages). Changed identifier to `com.example.myapp(.dev)` placeholder, app name from `StateCarry(-Dev)` to `MyApp(-Dev)`. Changed the stable identifier literal in `desktopRuntimeEnvironment` to placeholder as well. Function structure and logic remain the same.
- `apps/desktop/scripts/build-web.mjs`: Changed env var from `STATECARRY_DESKTOP_ENV` to `DESKTOP_ENV`. Extracted vite config path (`apps/web/vite.config.ts`) as a top-level constant with "adjust to match project layout" comment (same pattern as run-turbo.ts). Changed "StateCarry" in error messages to generic expression. Everything else is unchanged.
- `package.json.snippet`: Extracted only desktop scripts from StateCarry scripts. Excluded `desktop:dev` (tsx launcher); changed remaining `STATECARRY_DESKTOP_ENV` occurrences to `DESKTOP_ENV`. Includes only electrobun `2.0.1` (exact pin) devDependency.