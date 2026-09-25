# agents module

Agent operational guidance layer. Manages both human-readable README and agent-readable AGENTS.md using the StateCarry pattern's universal version. All content was extracted from StateCarry, with project-specific items removed to make it a universal version.

Unlike other modules, it does not have a `package.json.snippet`. This module provides only document templates, with no installed dependencies or scripts to run.

## Included Items

- `files/AGENTS.md` — Agent operational guidance template. Check-in of settings, in-work check, handoff verification, lockfile ownership, UI skill policies 5 lines.
- `files/decisions/0000-template.md` — ADR template. Template with placeholder guidance that mirrors the document structure of StateCarry's `docs/decisions/0001-electrobun.md`.

## Manual Application Procedure

### AGENTS.md

Copy it to the project root:

```sh
cp <kit>/modules/agents/files/AGENTS.md AGENTS.md
```

If an existing AGENTS.md is present, merge via diff rather than overwriting. Unique project rules can be freely added below — the template does not impose a section structure for unique rules, only the template's own section structure.

### ADR Template

```sh
mkdir -p docs/decisions
cp <kit>/modules/agents/files/decisions/0000-template.md docs/decisions/0000-template.md
```

When recording a new decision, copy the template and assign a number. ADR numbers follow the 4-digit 0-padding convention (0001, 0002, ...), which is also noted as a comment at the top of the template file.

## UI Skill Policy

- **Create (default for UI work)**: [impeccable](https://github.com/pbakaus/impeccable) skill. Installation is supported via tool — `npx impeccable install`. ZCode manually copies the skill to its skill folder (`~/.agents/skills`), and ZCode does not support hook manifests. Even without hook manifests, the skill's body and `npx impeccable detect` (LLM-less deterministic check of 61 items) operate.
- **Review**: [web-design-guidelines](https://github.com/vercel) skill (Vercel). Used for UI code review/audit triggered by "review my UI".
- **Priority**: If the project has its own UI principles document (`docs/ui-principles.md` etc.), it takes priority over the skill.

This policy is generalized and included as the last line of the AGENTS.md template.

## Dependencies

- **No requires** — As a document template, it can be applied independently. However, since AGENTS.md pre-supposes quality module scripts (`format:check`, `lint`, `verify`), the combination with quality is the default. Notated as a soft dependency relationship with the [typescript](../typescript/) module.

## Intentionally Excluded

- **Package-specific required-reading structure** — No original in StateCarry (AGENTS.md has only 1 at the root). Design it in the first applying project, then add to this module.
- **development.md skeleton** — Mostly invented if created from scratch. On hold.
- **Release credentials line and product document references** — `desktop:build:stable` credentials procedure and `docs/ux-writing.md` reference are product-specific. Keeping credentials outside the repo is documented in the [electrobun module](../electrobun/) README's codesign/notarize section.
- **Project-specific rules section structure** — Not made at the template end. Projects freely add under AGENTS.md.

## StateCarry Original Change History

The original is in [active/statecarry](../../../active/statecarry)'s `AGENTS.md` (9 lines) and `docs/decisions/0001-electrobun.md`.

- `files/AGENTS.md`: Translated from English to Korean. Removed 2 lines — release credentials (`desktop:build:stable` and `source ~/.config/statecarry/release-env.zsh`), `docs/ux-writing.md` reference (both product-specific). UI line generalized — original's "Follow `docs/ui-principles.md` ..." changed to "If a project's UI principles document exists, follow it; otherwise use impeccable/web-design-guidelines skills". Command contract adjusted to kit version — removed "in-work check" line `pnpm check` (StateCarry's `check` is product-specific via boundaries, kit's quality module scripts have no such thing). Everything else (broad disable prohibition, focus test, verify replacing only `dist/` output, `pnpm-lock.yaml` ownership) is the same as the original meaning.
- `files/decisions/0000-template.md`: Replaced content from `0001-electrobun.md`'s structure with placeholder guidance. Maintains title format (`# ADR 000X: <Title>`), header (Status/Date/Scope), Context / Decision / Benefits / Trade-offs and consequences sections, and the Decision's numbered list format. Did not include original's Evidence / Uncertainty and measurement policy / Reconsideration triggers sections — these can be added individually in decision documents as needed, not included in the universal template. Left the 4-digit 0-padding ADR convention in the file's top comment.