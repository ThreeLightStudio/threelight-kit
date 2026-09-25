# Repository checks

- Use the checked-in Oxfmt and Oxlint settings. Do not add broad disables or skip tests to pass checks.
- Run `pnpm format:check` and `pnpm lint` while working. Run focus tests for changed behavior.
- Run `pnpm verify` before handoff; report failures if any. `verify` can override ignored `dist/` output but must not rewrite source or settings.
- Treat `pnpm-lock.yaml` as pnpm-owned output. Do not format or manually edit it.
- Before changing layout, navigation, hierarchy, interaction, loading behavior, component composition, or visual emphasis, follow the project's UI principles document if it exists. Otherwise, use the impeccable skill for UI work, and web-design-guidelines skill for UI code review/audit.