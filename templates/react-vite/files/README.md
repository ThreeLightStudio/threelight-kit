# {{projectName}}

A React, TypeScript, and Vite starter created with ThreeLight Kit.

## Start locally

Use Node **{{nodeVersion}}** (supported range: `{{nodeRange}}`) and pnpm **{{pnpmVersion}}**. The exact Node version is recorded in `.node-version`; `package.json` pins the package manager.

```sh
npm exec --yes --package=pnpm@{{pnpmVersion}} -- pnpm dev
```

Creation already installs dependencies and verifies the project. If the declared pnpm is available, `pnpm dev` also works. The command above uses the pinned version without a global installation.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Edit `src/App.tsx` to change the first screen. The development server binds to loopback and uses a fixed port. If port 5173 is occupied, stop the other server or pass `--port 5174` to the development command. No configuration edit is required.

## Verify and preview

```sh
pnpm verify
pnpm preview
```

`verify` checks formatting, lint, types, the real application rendering test, and the production build. It checks source files without rewriting them; the build writes only `dist/`. Run `pnpm format` to fix formatting, then rerun `pnpm verify`. When the declared pnpm is unavailable, prefix commands with `npm exec --yes --package=pnpm@{{pnpmVersion}} --`.

The preview opens at [http://127.0.0.1:4173](http://127.0.0.1:4173) and serves the last build. Run `pnpm build` after subsequent changes before previewing. If port 4173 is occupied, stop that server or pass `--port 4174` to the preview command. Neither local server is a production deployment.

## Project layout

- `src/main.tsx`: mounts the application and imports its styles.
- `src/App.tsx`: the first screen.
- `src/project.ts`: project identity and a working `@/` import example.
- `tests/App.test.tsx`: renders the actual application through `react-dom/server`.
- `tsconfig.json`: the source of truth for the `@/*` path alias; Vite and Vitest share it.
- `.github/workflows/verify.yml`: uses Node {{nodeVersion}}, pnpm {{pnpmVersion}}, and `{{runner}}` to run the same `pnpm verify` command.

## When a command fails

- **Unsupported Node version:** switch to the version in `.node-version`, then rerun `pnpm install`.
- **Missing dependencies:** run `pnpm install`; if a prior installation was interrupted, rerun it before verification.
- **Formatting failure:** run `pnpm format`, review the changes, and rerun `pnpm verify`.
- **Type, lint, or test failure:** fix the file reported by the command and rerun `pnpm verify`. Tests intentionally fail if no tests are found.
- **CI lockfile failure:** run `pnpm install` with pnpm {{pnpmVersion}}, commit `pnpm-lock.yaml`, and rerun CI. CI uses `--frozen-lockfile` to keep installation reproducible.

Learn more in the [Vite guide](https://vite.dev/guide/) and [React documentation](https://react.dev/learn).
