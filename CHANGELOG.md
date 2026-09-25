# Changelog

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