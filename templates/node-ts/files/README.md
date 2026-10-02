# {{projectName}}

A Node.js and TypeScript command-line starter created with ThreeLight Kit.

## Run locally

Use Node **{{nodeVersion}}** (supported range: `{{nodeRange}}`). The exact version is recorded in `.node-version`; `package.json` pins pnpm **{{pnpmVersion}}**. These commands use the pinned package manager without a global installation.

Creation already installs dependencies, formats the new files, and verifies the project. Start the source entry with automatic restarts:

```sh
npm exec --yes --package=pnpm@{{pnpmVersion}} -- pnpm dev
```

The command prints a greeting for {{projectName}}. Edit `src/index.ts` and save to see the process restart. Press Ctrl+C to stop the watcher. This starter does not start a web server.

To run the compiled entry:

```sh
npm exec --yes --package=pnpm@{{pnpmVersion}} -- pnpm build
npm exec --yes --package=pnpm@{{pnpmVersion}} -- pnpm start
```

`build` emits only `src/` into `dist/`. Tests and tool configuration are checked but do not become production output. Use `.js` extensions for relative TypeScript imports: NodeNext checks the source modules, Vitest resolves them during tests, and compiled Node.js uses the same import paths. Rebuild after source changes before running `start`.

## Verify

```sh
npm exec --yes --package=pnpm@{{pnpmVersion}} -- pnpm verify
```

Verification checks formatting, lint, source and test types, the greeting behavior, and the production build. Source checks do not rewrite files; the build writes only `dist/`. The test command fails if no tests are found.

## Project layout

- `src/index.ts`: runnable command-line entry with the configured project name.
- `src/greeting.ts`: reusable function shared by the entry and its behavior tests.
- `tests/greeting.test.ts`: project identity and missing-input checks using NodeNext `.js` imports.
- `tsconfig.json`: NodeNext ESM profile for source, tests, and Vitest configuration, without browser or JSX libraries.
- `tsconfig.build.json`: production emit configuration for `src/` only.
- `.github/workflows/verify.yml`: Node {{nodeVersion}}, pnpm {{pnpmVersion}}, and `{{runner}}`, running the same verification.

## Recover from a failed command

- **Unsupported Node version:** switch to the version in `.node-version` before retrying installation or verification.
- **Interrupted or missing installation:** run the installation command below, then rerun verification. Generated files are preserved when creation fails.
- **Formatting failure:** run the formatting command below, review the changes, and rerun verification.
- **Type, lint, test, or build failure:** fix the reported file and rerun verification. Rebuild before running compiled output.
- **CI lockfile failure:** install with the pinned pnpm, commit the updated `pnpm-lock.yaml`, and rerun CI. CI uses a frozen lockfile.

```sh
npm exec --yes --package=pnpm@{{pnpmVersion}} -- pnpm install --no-frozen-lockfile
npm exec --yes --package=pnpm@{{pnpmVersion}} -- pnpm format
npm exec --yes --package=pnpm@{{pnpmVersion}} -- pnpm verify
```

This project starts private. No package publication or deployment is configured.
