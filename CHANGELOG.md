# Changelog

## [Unreleased]

### Added
- Initial CLI (`kit`) with `init <preset|module>` and `list` commands: copies module `files/`, merges `package.json` snippets, resolves `requires` dependencies, runs `pnpm install` / `format` / `verify`
- Presets: `react-vite`, `desktop-react`

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