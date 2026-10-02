# {{projectName}}

A React desktop application for macOS on Apple Silicon, using Electrobun 2.0.1
and its native Cottontail runtime. Node {{nodeVersion}} or a later supported Node
24 release and pnpm {{pnpmVersion}} are required.

```sh
pnpm dev
```

This builds the web view, opens the native application, and watches project
changes. Edit `apps/web/src/App.tsx` for the interface and
`apps/desktop/src/main.ts` for native window behavior.

```sh
pnpm verify
pnpm preview
```

Verification checks formatting, lint, TypeScript, the actual React application
tests, and an unsigned native development build. Preview starts that built app.
The bundle is beneath `.cache/electrobun/build`; web assets are in
`.cache/electrobun/web`.

`pnpm dev:web` and `pnpm preview:web` open only the web interface. `pnpm build:web`
builds that interface independently. `pnpm desktop:prepare` downloads the pinned
native toolchain and produces `.hutch/devkit`, which contains the authoritative
SDK types. The npm package is a CLI bootstrap; the starter's narrow declarations
cover only the desktop APIs currently used.

The first native build needs network access to acquire Hutch, Cottontail,
Electrobun core, and the vendored esbuild binary. It needs `tar`, and does not
require a separately installed Bun, Apple Developer account, signing credentials,
notarization, or DMG generation.

The app identifier is `{{appIdentifier}}`. The root `package.json` owns the app
version; web and native metadata read that same value. Add release commands only
after a separate release configuration. This starter supplies no update feed.
