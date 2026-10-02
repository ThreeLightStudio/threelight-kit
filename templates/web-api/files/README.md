# {{projectName}}

A React/Vite web app and a Node HTTP API in one private pnpm workspace. Versions, dependencies, checks, and task commands live at the repository root; the application packages contain only their identity and module type.

## Start locally

Use Node **{{nodeVersion}}** (supported range: `{{nodeRange}}`) and pnpm **{{pnpmVersion}}**.

```sh
npm install --global pnpm@{{pnpmVersion}}
pnpm install
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The launcher waits up to 15 seconds for [http://127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health) before starting Vite. Vite forwards `/api` requests to that API, so the browser uses one origin. The first screen displays **API ready** after a real health request.

Edit `apps/web/src/App.tsx` for the screen and `apps/server/src/app.ts` for the API. Vite updates the web app on save. Restart `pnpm dev` after server changes. Press Ctrl+C to stop both servers; startup failures or an unexpected child exit also stop the other owned process group.

## Optional local configuration

Defaults work without any configuration or secrets. Copy `.env.example` to `.env` to change local ports:

```dotenv
HOST=127.0.0.1
WEB_PORT=5173
API_PORT=8787
```

Shell variables take precedence over `.env`. Ports must be distinct integers from 1 to 65535. `HOST` must remain `127.0.0.1`; this starter binds to loopback. One shared `scripts/runtime-config.mjs` supplies the launcher, Vite proxy, and API settings. Local data is confined to `.cache/dev/`; no production data path is read or migrated.

If a port is occupied, the launcher fails before starting either server. Stop the process that owns the port or choose another port in `.env`. The launcher never stops an existing unrelated process.

## Verify and run the built app

```sh
pnpm verify
pnpm start
```

`verify` checks formatting, lint, TypeScript, an actual HTTP API test, and application rendering before building both parts. Checks do not rewrite source; build outputs are `dist/web/` and `dist/server/app/`. Run `pnpm format` to fix formatting before repeating verification.

`start` serves the built web app and API together at [http://127.0.0.1:8787](http://127.0.0.1:8787), or the configured `API_PORT`. No separate web server or proxy is needed. `pnpm preview` runs the same built application. Run `pnpm build` after subsequent source changes before starting it again.

The Node build uses NodeNext resolution and starts from `dist/server/app/index.js`. That output depth preserves its shared runtime-config import; the shared configuration is not copied or emitted into `dist/`.

## Project layout

- `apps/web/`: HTML entry, React application, and styles.
- `apps/server/src/`: HTTP API and startup/shutdown lifecycle.
- `packages/contracts/`: types-only `HealthResponse` shared by the API and web app.
- `scripts/runtime-config.mjs`: `.env`, local ports, root project identity/version, and development paths.
- `scripts/dev.mjs`: port preflight, API readiness, Vite startup, and owned-process cleanup.
- `tests/`: real HTTP API requests and rendering of the actual React application.
- `tsconfig.json`: the source of truth for `@/*` and `@server/*` aliases. Vite derives them and Vitest uses the same configuration.
- `.github/workflows/verify.yml`: Node {{nodeVersion}}, pnpm {{pnpmVersion}}, and `{{runner}}`; CI runs the same root verification.

## When a command fails

- **Node or package-manager mismatch:** use `.node-version` and pnpm {{pnpmVersion}}, then rerun `pnpm install`.
- **API startup or readiness failure:** read the API output, fix its reported configuration or source error, and restart `pnpm dev`. The web app is not started until the health response is ready.
- **Web or API process exits:** the launcher stops its owned sibling and returns a failure. Fix the reported problem and restart both with `pnpm dev`.
- **Formatting failure:** run `pnpm format`, review the changes, and rerun `pnpm verify`.
- **Type, lint, or test failure:** fix the reported file and rerun `pnpm verify`. Missing tests intentionally fail.
- **Missing build:** run `pnpm build` before `pnpm start`; the built server also checks that the web build exists.
- **CI lockfile failure:** run `pnpm install` with pnpm {{pnpmVersion}}, commit `pnpm-lock.yaml`, and retry CI. CI installs with `--frozen-lockfile`.
