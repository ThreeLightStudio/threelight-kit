# Changelog

## [Unreleased]

### Added

- Runnable Node TypeScript, React/web-API workspace, and unsigned macOS ARM64 desktop starters, with runtime-specific tests and actual build verification.
- Shared web/API environment and health contracts, preflight port checks, bounded readiness, and coordinated owned-process cleanup.
- Native runtime platform, architecture, and executable checks before generation, with a matching macOS ARM64 CI runner.
- Portable and packed P1 integration checks, including compiled Node execution, HTTP development/production serving, and optional actual native builds.
- Runnable `kit create react-vite <directory>` starter with source, rendering test, root-source aliases, development/build/preview scripts, agent guidance, and CI.
- JSON module dependency metadata with recursive dependency-first ordering and cycle/unknown-dependency validation.
- Creation runtime metadata shared by local installation, manifest declarations, and CI, with pinned pnpm execution without a global reinstall.
- Non-mutating creation and configuration dry runs, pre-write destination/composition checks, and recovery commands for failed installation or verification.
- Packaged creation tests covering two independent projects, development/preview serving, frozen installation, and expected check failures.

### Changed

- `list` distinguishes runnable starters from configuration-only presets. `init` retains its workspace configuration and merge behavior; dependencies now apply before consumers.
- Creation verification requires collected tests and includes the production build without rewriting source. Existing configuration-only verification remains unchanged.
- Creation-only presets reject `init` with an actionable `create` command; desktop creation omits release scripts through explicit recipe metadata.

### Fixed

- Runnable desktop watching includes both application source trees and ignores generated native output; launcher cleanup survives an early CLI exit.
- Runnable web/API shutdown remains active across repeated package-manager signals and cleans its detached server groups.

- CLI: `requires` dependency resolution never matched — the parser only accepted `requires: [a, b]` array syntax while module READMEs declare dependencies in prose (`**requires: a**`), so `init` never pulled in declared dependencies (caught by the new smoke tests)
- CLI: `init` no longer fails on modules that don't provide `format`/`verify` scripts — those steps now run only when the merged `package.json` has them (previously bare `kit init agents` / `typescript` / `electrobun` died with `ERR_PNPM_NO_SCRIPT` after a partial init)
- git: `verify.yml` moved to `files/.github/workflows/verify.yml` so the CLI copies it to the location GitHub Actions requires (previously it landed at the project root, where it does nothing)

### Added

- Initial CLI (`kit`) with `init <preset|module>` and `list` commands: copies module `files/`, merges `package.json` snippets, resolves `requires` dependencies, runs `pnpm install` / `format` / `verify`
- Presets: `react-vite`, `desktop-react`
- CLI smoke test suite (`tests/smoke.js`, wired as `test:smoke` / `test:smoke:full` npm scripts): fast tier stubs `pnpm` to verify copy/merge/dependency resolution offline; `--full` tier runs a real install + verify

### Changed

- README updated to reflect the CLI and presets (previous version stated neither existed yet)

## [0.1.1] - 2026-09-26

### Fixed

- quality: Added `node_modules/**` to `.oxlintrc.json` ignorePatterns to prevent oxlint scanning node_modules (verified across 2 test projects)

### Documented

- quality: Added explicit note about config file copy requirement — if `.oxlintrc.json` is not copied, lint will fail on node_modules

## [0.1.0] - 2026-09-25

### Added

- Initial repository setup with restored remote origin
- MIT LICENSE file added
- Initial version tag v0.1.0 created
- .gitignore for Node.js/pnpm projects
- README documentation
- Core project structure with modules
