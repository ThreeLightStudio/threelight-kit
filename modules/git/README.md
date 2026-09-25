# git module

GitHub Actions verify workflow and universal .gitignore. All values extracted from StateCarry, with project-specific items removed to make a universal version.

## Included Items

- `files/.gitignore` — Universal .gitignore. Moved from quality module without content changes.
- `files/verify.yml` — GitHub Actions workflow. Runs checkout → Node/pnpm install → `pnpm install --frozen-lockfile` → `pnpm verify` on every push/PR.

## Manual Application Procedure

From the project root:

1. Copy .gitignore
   ```sh
   cp <kit>/modules/git/files/.gitignore .
   ```
   If an existing file is present, merge it (diff before overwriting).
2. Copy verify workflow
   ```sh
   mkdir -p .github/workflows
   cp <kit>/modules/git/files/verify.yml .github/workflows/verify.yml
   ```
3. Node version (`24.14.1`) and pnpm version (`10.33.2`) in the workflow are verified example values. Adjust to match your project's `engines.node` / `packageManager` values.

## Dependencies

- `verify.yml` runs `pnpm verify`, so **requires: quality**. Must be applied with the quality module.
- `.gitignore` can be used standalone.

## Intentionally Excluded

- **Issue/PR templates, commit convention, branch operation rules** — None yet. Creating without verified originals would be speculation. Will be written when the first applying project appears, then added to this module.

## StateCarry Original Change History

- `verify.yml`: Changed default runner from `macos-15` to `ubuntu-latest`, and added comment "projects applying electrobun module should use macos-15". StateCarry needs macOS runner due to electrobun, but Linux is the universal default. Everything else remains the same (pinned action SHAs, `persist-credentials: false`, exact pnpm version install, `--frozen-lockfile`, `pnpm verify`).
- `.gitignore`: Moved from quality module without content changes. Compared to StateCarry original, `.hutch/`, `.cottontail-tmp/`, `.statecarry/` lines were removed. `.hutch/`, `.cottontail-tmp/` are restored as tool artifacts (hutch, cottontail), reclassified with separate section and comment "Electrobun toolchain artifacts (hutch, cottontail)". `.statecarry/` is product-specific and remains removed; its section's comment changed to "Local caches and transient data". SQLite entries (`*.sqlite*`, `*.db`, `*.db-wal`, `*.db-shm`) retention is a deliberate decision.