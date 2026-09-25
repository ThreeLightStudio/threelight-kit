# Changelog

## [Unreleased]

### Fixed
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