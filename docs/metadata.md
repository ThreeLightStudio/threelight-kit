# Module and creation contracts

Module directories contain a `module.json` with a `requires` array of module names.
Dependencies are resolved recursively, once each, before their consumers. Unknown
dependencies and cycles are errors before project files are written. README prose
is documentation, not dependency metadata.

The existing preset `modules` array is the configuration-only `kit init` contract.
Creation-only presets declare `configuration: false`; `kit init` then directs users
to `kit create` instead of applying a mismatched generic configuration.
An optional `create` object declares a runnable project:

- `layout`: the supported project layout (`single-package` or `workspace`).
- `runtime`: the name of a JSON file in `runtimes/`, without its extension.
- `template`: the repository-relative template directory.
- `modules`: the ordered root modules used by project creation.
- `overrides.files`: module files that the template deliberately replaces.
- `overrides.package`: package fields that the template deliberately replaces,
  expressed as dotted keys such as `scripts.test`.
- `removePackage`: optional contributed script/dependency fields to omit from
  creation, such as `scripts.desktop:build:stable`. Each named field must exist.

Different contributions to the same file or package field are errors unless the
recipe declares the replacement. Identical contributions may be deduplicated.
The creation contract does not change the existing init merge behavior.

Removals run after composition and only address entries in `scripts`,
`dependencies`, or `devDependencies`. They let an unsigned desktop starter reuse
the configuration module while omitting release commands outside its scope.

Runtime files declare `node`, `nodeRange`, `pnpm`, and `runner`. Creation uses this
source for `.node-version`, manifest engines/packageManager, package-manager
execution, and CI. The first recipe supports Node 24 at or above the declared
minimum. Existing init module values remain unchanged.

Native recipes may additionally declare `platform`, `architecture`, and a
`commands` array. Creation checks platform/architecture and the availability of
these executables before writing. Dry runs report prerequisites without executing
or installing them. The desktop recipe targets macOS Apple Silicon and uses the
matching ARM runner; the native SDK is downloaded by Electrobun when needed.

Templates contain a `files/` tree and optional `package.json.snippet`. The creation
renderer replaces `{{projectName}}`, `{{nodeVersion}}`, `{{nodeRange}}`,
`{{pnpmVersion}}`, `{{runner}}`, and `{{appIdentifier}}`. Package names must be valid unscoped lowercase
npm names, and inserted values must not introduce code, HTML, or shell syntax.
Unknown template tokens fail before writes. Runtime-owned manifest values are
applied after recipe composition.

`appIdentifier` is generated as `com.threelight.<project-name>`, replacing dots and
underscores in the package name with hyphens. It provides a project-specific
development bundle identity without requiring a signing or release account.

The first recipe owns its `src` TypeScript/Vite/Vitest profile and strict test and
build verification scripts. Init continues to use the workspace-shaped profile.
Generated projects begin at version `0.1.0` and are private.

Creation is permitted in a missing directory, an empty directory, or a directory
containing only a real `.git` entry. Symlink destinations and ancestors are not
accepted. Dry runs do not create directories, download packages, or run scripts.
After generation, a failed installation or check preserves the project and prints
recovery commands; it does not report successful creation.
