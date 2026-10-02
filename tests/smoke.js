#!/usr/bin/env node
/**
 * ThreeLight Kit CLI smoke tests.
 *
 * Usage:
 *   node tests/smoke.js          Fast tier: command surface, error paths, and the full
 *                                init flow against a stubbed pnpm (no network, no installs).
 *   node tests/smoke.js --full   Also run the full tier: a real `kit init react-vite`
 *                                with a real pnpm install + verify (network required).
 *   SMOKE_FULL=1 is accepted as an alias for --full.
 *
 * Every test runs in its own temp directory, cleaned up afterwards. The fast tier
 * puts a fake `pnpm` on PATH that records invocations to a log file and emulates
 * pnpm's behavior of failing on `run <missing-script>`, so the suite asserts file
 * copying, package.json merging, dependency resolution and command sequencing
 * without installing anything.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const KIT = path.resolve(__dirname, '..', 'kit');
const FULL = process.env.SMOKE_FULL === '1' || process.argv.includes('--full');

const PRESETS = ['desktop-react', 'react-vite'];
const MODULES = ['agents', 'electrobun', 'git', 'quality', 'react-vite', 'typescript', 'workspace'];

// --- tiny harness -----------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, message: e.message });
    console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}\n      expected to include: ${JSON.stringify(needle)}\n      actual: ${JSON.stringify(haystack.slice(0, 400))}`);
  }
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label}: file does not exist: ${filePath}`);
  }
}

// --- helpers ----------------------------------------------------------------

function runKit(args, { cwd, env = process.env, timeout = 60000 } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [KIT, ...args], {
      cwd,
      env,
      encoding: 'utf8',
      timeout,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return {
      status: e.status === undefined ? -1 : e.status,
      stdout: String(e.stdout || ''),
      stderr: String(e.stderr || ''),
    };
  }
}

function makeTempProject(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `kit-smoke-${label}-`));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Creates a directory holding a fake `pnpm` that logs its arguments to
 * $PNPM_LOG and emulates pnpm's real behavior of failing on
 * `run <missing-script>`. Returns env vars with the stub's bin dir on PATH.
 */
function stubbedEnv(logPath) {
  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-smoke-pnpmstub-'));
  const stub = path.join(stubDir, 'pnpm');
  fs.writeFileSync(
    stub,
    `#!/usr/bin/env node
const fs = require('fs');
const invocation = 'pnpm ' + process.argv.slice(2).join(' ');
if (process.env.PNPM_LOG) fs.appendFileSync(process.env.PNPM_LOG, invocation + '\\n');
console.log(invocation);
const [cmd, script] = process.argv.slice(2);
if (cmd === 'run' && script) {
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); } catch {}
  if (!((pkg.scripts || {})[script])) {
    console.error('[ERR_PNPM_NO_SCRIPT] Missing script: ' + script);
    process.exit(1);
  }
}
`
  );
  fs.chmodSync(stub, 0o755);
  return {
    ...process.env,
    PNPM_LOG: logPath,
    PATH: `${stubDir}:${process.env.PATH}`,
    KIT_SMOKE_STUB_DIR: stubDir,
  };
}

function readPnpmLog(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
}

function cleanupDir(dir) {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
}

// --- section A: command surface (no stub, no project state) -----------------

console.log('\nA. Command surface');

check('no args prints usage and exits 0', () => {
  const r = runKit([]);
  assertEq(r.status, 0, 'exit status');
  assertIncludes(r.stdout, 'Usage: kit', 'stdout');
  assertIncludes(r.stdout, 'init <preset|module>', 'stdout');
  assertIncludes(r.stdout, 'list', 'stdout');
});

check('unknown command prints usage (documents current exit 0)', () => {
  const r = runKit(['not-a-command']);
  assertEq(r.status, 0, 'exit status');
  assertIncludes(r.stdout, 'Usage: kit', 'stdout');
});

check('list shows presets and all modules', () => {
  const r = runKit(['list']);
  assertEq(r.status, 0, 'exit status');
  assertIncludes(r.stdout, 'Presets:', 'stdout');
  for (const p of PRESETS) assertIncludes(r.stdout, p, 'presets line');
  assertIncludes(r.stdout, 'react-vite: quality, typescript, react-vite', 'preset composition');
  assertIncludes(r.stdout, 'desktop-react: quality, typescript, react-vite, electrobun', 'preset composition');
  assertIncludes(r.stdout, 'Modules:', 'stdout');
  for (const m of MODULES) assertIncludes(r.stdout, m, 'modules line');
});

check('list declares requires for modules that have them', () => {
  const r = runKit(['list']);
  assertIncludes(r.stdout, 'git (requires: quality)', 'modules list');
  assertIncludes(r.stdout, 'workspace (requires: quality)', 'modules list');
  assertIncludes(r.stdout, 'electrobun (requires: react-vite)', 'modules list');
});

check('init without target exits 1 with usage', () => {
  const r = runKit(['init']);
  assertEq(r.status, 1, 'exit status');
  assertIncludes(r.stderr, 'Usage: kit init', 'stderr');
});

check('init with unknown target exits 1 and lists alternatives', () => {
  const r = runKit(['init', 'nope']);
  assertEq(r.status, 1, 'exit status');
  assertIncludes(r.stderr, 'Unknown module or preset: nope', 'stderr');
  assertIncludes(r.stderr, 'Available presets:', 'stderr');
  assertIncludes(r.stderr, 'Available modules:', 'stderr');
});

// --- section B: init flow with stubbed pnpm ---------------------------------

console.log('\nB. init flow (pnpm stubbed)');

check('init quality: copies files, merges snippet, preserves existing fields', () => {
  const dir = makeTempProject('quality');
  let stubDir = null;
  try {
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'smoke-proj', private: true, scripts: { 'my:task': 'echo hi' }, dependencies: { left: '1.0.0' } }, null, 2) + '\n'
    );
    const logPath = path.join(dir, 'pnpm-log.txt');
    const env = stubbedEnv(logPath);
    stubDir = env.KIT_SMOKE_STUB_DIR;

    const r = runKit(['init', 'quality'], { cwd: dir, env });
    assertEq(r.status, 0, `exit status (stderr: ${r.stderr.slice(0, 200)})`);
    assertIncludes(r.stdout, '✅', 'stdout');

    assertFileExists(path.join(dir, '.oxfmtrc.json'), 'quality files copied');
    assertFileExists(path.join(dir, '.oxlintrc.json'), 'quality files copied');

    const pkg = readJson(path.join(dir, 'package.json'));
    assertEq(pkg.name, 'smoke-proj', 'existing name preserved');
    assertEq(pkg.scripts['my:task'], 'echo hi', 'existing script preserved');
    assertEq(pkg.dependencies.left, '1.0.0', 'existing dependency preserved');
    assertEq(pkg.scripts.format, 'oxfmt --write .', 'quality script merged');
    assertIncludes(pkg.scripts.verify, 'format:check', 'verify chain merged');
    assertEq(pkg.devDependencies.oxfmt, '0.68.0', 'quality devDependency merged');
    assertEq(pkg.packageManager, 'pnpm@10.33.2', 'packageManager merged');

    assertEq(
      readPnpmLog(logPath).join('\n'),
      ['pnpm install --no-frozen-lockfile', 'pnpm run format', 'pnpm run verify'].join('\n'),
      'pnpm command sequence'
    );
  } finally {
    cleanupDir(dir);
    cleanupDir(stubDir);
  }
});

check('init typescript: bootstraps package.json and copies configs', () => {
  const dir = makeTempProject('ts');
  let stubDir = null;
  try {
    const logPath = path.join(dir, 'pnpm-log.txt');
    const env = stubbedEnv(logPath);
    stubDir = env.KIT_SMOKE_STUB_DIR;

    const r = runKit(['init', 'typescript'], { cwd: dir, env });
    assertEq(r.status, 0, `exit status (stderr: ${r.stderr.slice(0, 200)})`);

    const pkg = readJson(path.join(dir, 'package.json'));
    assertEq(pkg.name, path.basename(dir), 'bootstrapped name from directory');
    assertEq(pkg.private, true, 'bootstrapped as private');
    assertEq(pkg.devDependencies.typescript, '^5.9.2', 'typescript devDependency merged');

    assertFileExists(path.join(dir, 'tsconfig.json'), 'typescript files copied');
    assertFileExists(path.join(dir, 'vitest.config.ts'), 'typescript files copied');
    assertEq(
      readPnpmLog(logPath).join('\n'),
      'pnpm install --no-frozen-lockfile',
      'format/verify skipped, install still ran'
    );
    assertIncludes(r.stdout, '✅', 'stdout');
  } finally {
    cleanupDir(dir);
    cleanupDir(stubDir);
  }
});

check('init agents: docs-only module, no snippet fields merged', () => {
  const dir = makeTempProject('agents');
  let stubDir = null;
  try {
    const logPath = path.join(dir, 'pnpm-log.txt');
    const env = stubbedEnv(logPath);
    stubDir = env.KIT_SMOKE_STUB_DIR;

    const r = runKit(['init', 'agents'], { cwd: dir, env });
    assertEq(r.status, 0, `exit status (stderr: ${r.stderr.slice(0, 200)})`);

    assertFileExists(path.join(dir, 'AGENTS.md'), 'agents files copied');
    assertFileExists(path.join(dir, 'decisions', '0000-template.md'), 'nested files copied');

    const pkg = readJson(path.join(dir, 'package.json'));
    assertEq(pkg.private, true, 'package.json bootstrapped');
    assert(!pkg.scripts, 'no snippet, so no scripts merged');

    assertEq(
      readPnpmLog(logPath).join('\n'),
      'pnpm install --no-frozen-lockfile',
      'format/verify skipped, install still ran'
    );
    assertIncludes(r.stdout, '✅', 'stdout');
  } finally {
    cleanupDir(dir);
    cleanupDir(stubDir);
  }
});

check('init react-vite preset: applies all three modules in order', () => {
  const dir = makeTempProject('preset');
  let stubDir = null;
  try {
    const env = stubbedEnv(path.join(dir, 'pnpm-log.txt'));
    stubDir = env.KIT_SMOKE_STUB_DIR;

    const r = runKit(['init', 'react-vite'], { cwd: dir, env });
    assertEq(r.status, 0, `exit status (stderr: ${r.stderr.slice(0, 200)})`);

    assertIncludes(r.stdout, 'Initializing react-vite with modules: quality, typescript, react-vite', 'module resolution line');

    assertFileExists(path.join(dir, '.oxlintrc.json'), 'quality file copied');
    assertFileExists(path.join(dir, 'tsconfig.json'), 'typescript file copied');
    assertFileExists(path.join(dir, 'vite.config.ts'), 'react-vite file copied');

    const pkg = readJson(path.join(dir, 'package.json'));
    assertEq(pkg.scripts.test, 'vitest run --passWithNoTests', 'quality script merged');
    assertEq(pkg.dependencies.react, '^19.1.1', 'react dependency merged');
    assertEq(
      readPnpmLog(path.join(dir, 'pnpm-log.txt')).join('\n'),
      ['pnpm install --no-frozen-lockfile', 'pnpm run format', 'pnpm run verify'].join('\n'),
      'pnpm command sequence'
    );
  } finally {
    cleanupDir(dir);
    cleanupDir(stubDir);
  }
});

check('init desktop-react preset: includes electrobun with nested files', () => {
  const dir = makeTempProject('desktop');
  let stubDir = null;
  try {
    const env = stubbedEnv(path.join(dir, 'pnpm-log.txt'));
    stubDir = env.KIT_SMOKE_STUB_DIR;

    const r = runKit(['init', 'desktop-react'], { cwd: dir, env });
    assertEq(r.status, 0, `exit status (stderr: ${r.stderr.slice(0, 200)})`);

    assertIncludes(r.stdout, 'quality, typescript, react-vite, electrobun', 'module resolution line');
    assertFileExists(path.join(dir, 'electrobun.config.ts'), 'electrobun file copied');
    assertFileExists(path.join(dir, 'apps', 'desktop', 'build-profile.ts'), 'nested electrobun file copied');
  } finally {
    cleanupDir(dir);
    cleanupDir(stubDir);
  }
});

check('init electrobun: resolves declared react-vite dependency, skips format/verify', () => {
  const dir = makeTempProject('dep');
  let stubDir = null;
  try {
    const env = stubbedEnv(path.join(dir, 'pnpm-log.txt'));
    stubDir = env.KIT_SMOKE_STUB_DIR;

    const r = runKit(['init', 'electrobun'], { cwd: dir, env });
    assertEq(r.status, 0, `exit status (stderr: ${r.stderr.slice(0, 200)})`);
    assertIncludes(r.stdout, 'Initializing electrobun with modules: react-vite, electrobun', 'dependency-first resolution');
    assertIncludes(r.stdout, '✅', 'stdout');
    assertFileExists(path.join(dir, 'electrobun.config.ts'), 'electrobun files copied');
    assertFileExists(path.join(dir, 'vite.config.ts'), 'react-vite files copied via dependency');
    assertEq(
      readPnpmLog(path.join(dir, 'pnpm-log.txt')).join('\n'),
      'pnpm install --no-frozen-lockfile',
      'format/verify skipped, install still ran'
    );
  } finally {
    cleanupDir(dir);
    cleanupDir(stubDir);
  }
});

check('init git: resolves quality, places workflow where GitHub Actions expects it', () => {
  const dir = makeTempProject('gitdep');
  let stubDir = null;
  try {
    const env = stubbedEnv(path.join(dir, 'pnpm-log.txt'));
    stubDir = env.KIT_SMOKE_STUB_DIR;

    const r = runKit(['init', 'git'], { cwd: dir, env });
    assertEq(r.status, 0, `exit status (stderr: ${r.stderr.slice(0, 200)})`);
    assertIncludes(r.stdout, 'Initializing git with modules: quality, git', 'dependency-first resolution');
    assertIncludes(r.stdout, '✅', 'stdout');
    assertFileExists(path.join(dir, '.github', 'workflows', 'verify.yml'), 'git workflow at GitHub Actions path');
    assertFileExists(path.join(dir, '.gitignore'), 'git .gitignore copied');
    assertFileExists(path.join(dir, '.oxlintrc.json'), 'quality files copied via dependency');
    assertEq(
      readPnpmLog(path.join(dir, 'pnpm-log.txt')).join('\n'),
      ['pnpm install --no-frozen-lockfile', 'pnpm run format', 'pnpm run verify'].join('\n'),
      'pnpm command sequence (quality scripts available)'
    );
  } finally {
    cleanupDir(dir);
    cleanupDir(stubDir);
  }
});

// --- section C: full tier (real install, opt-in) ----------------------------

if (FULL) {
  console.log('\nC. Full tier (real pnpm install + verify)');

  check('init react-vite end to end: install, format, verify all pass', () => {
    const dir = makeTempProject('full');
    try {
      const r = runKit(['init', 'react-vite'], { cwd: dir, timeout: 600000 });
      assertEq(r.status, 0, `exit status\n      stdout tail: ${r.stdout.slice(-400)}\n      stderr tail: ${r.stderr.slice(-400)}`);
      assertIncludes(r.stdout, '✅', 'stdout');
      assertFileExists(path.join(dir, 'node_modules', '.bin', 'vite'), 'vite installed');
      assertFileExists(path.join(dir, 'pnpm-lock.yaml'), 'lockfile created');
    } finally {
      cleanupDir(dir);
    }
  });

  check('init typescript end to end: skips format/verify when not provided', () => {
    const dir = makeTempProject('full-ts');
    try {
      const r = runKit(['init', 'typescript'], { cwd: dir, timeout: 300000 });
      assertEq(r.status, 0, `exit status\n      stdout tail: ${r.stdout.slice(-400)}\n      stderr tail: ${r.stderr.slice(-400)}`);
      assertIncludes(r.stdout, '✅', 'stdout');
      assertIncludes(r.stdout, 'skipping format', 'stdout');
      assertIncludes(r.stdout, 'skipping verify', 'stdout');
      assert(!r.stdout.includes('Running verify'), 'verify must not run');
      assertFileExists(path.join(dir, 'tsconfig.json'), 'typescript files copied');
    } finally {
      cleanupDir(dir);
    }
  });
} else {
  console.log('\nC. Full tier skipped (run with --full or SMOKE_FULL=1)');
}

// --- summary ----------------------------------------------------------------

console.log(`\nSmoke tests: ${passed} passed, ${failed} failed${FULL ? '' : ' (fast tier)'}`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ✗ ${f.name}\n      ${f.message}`);
  }
  process.exit(1);
}
