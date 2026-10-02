#!/usr/bin/env node
/**
 * Runnable-project integration checks.
 *
 * node tests/create.js          Isolated CLI fixtures and PATH stubs; no network.
 * node tests/create.js --full   Also create two projects from an npm tarball and
 *                              exercise real installation, checks and servers.
 * KIT_CREATE_TEST_NODE can select the supported Node executable for subprocesses.
 * KIT_CREATE_TEST_KEEP_DIR retains full-tier projects beneath an explicit directory.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.env.KIT_CREATE_TEST_NODE || process.execPath;
const FULL = process.argv.includes('--full');
const CHILD_ENV = {
  ...process.env,
  PATH: `${path.dirname(NODE)}${path.delimiter}${process.env.PATH || ''}`,
};
const TEMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-create-tests-')));
let passed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function output(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function succeeded(result, message) {
  assert(
    result.status === 0 && !result.error,
    `${message}\n${output(result).slice(-5000)}\n${result.error || ''}`,
  );
}

function failed(result, pattern, message) {
  assert(
    result.status !== 0 && !result.error,
    `${message}: expected a CLI failure\n${output(result)}`,
  );
  if (pattern)
    assert(
      pattern.test(output(result)),
      `${message}: missing diagnostic ${pattern}\n${output(result)}`,
    );
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    env: CHILD_ENV,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

function runKit(fixture, args, options = {}) {
  return run(NODE, [path.join(fixture.source, 'kit'), ...args], {
    cwd: fixture.base,
    env: fixture.env,
    ...options,
  });
}

function filesWithin(directory, excludedDirectories = []) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && excludedDirectories.includes(entry.name)) return [];
    return entry.isDirectory() ? filesWithin(absolute, excludedDirectories) : [absolute];
  });
}

function snapshot(directory, excludedDirectories = []) {
  return JSON.stringify(
    filesWithin(directory, excludedDirectories)
      .map((file) => [
        path.relative(directory, file),
        fs.lstatSync(file).isSymbolicLink()
          ? `link:${fs.readlinkSync(file)}`
          : fs.readFileSync(file).toString('base64'),
      ])
      .sort((left, right) => left[0].localeCompare(right[0])),
  );
}

function operations(fixture) {
  if (!fs.existsSync(fixture.log)) return [];
  return fs.readFileSync(fixture.log, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
}

function fixture(label, { missingPnpm = false, pnpmVersion, failStage } = {}) {
  const base = fs.mkdtempSync(path.join(TEMP, `${label}-`));
  const source = path.join(base, 'kit-source');
  fs.cpSync(ROOT, source, {
    recursive: true,
    filter: (file) =>
      !path
        .relative(ROOT, file)
        .split(path.sep)
        .some((part) => ['.git', 'node_modules'].includes(part)),
  });
  const preset = readJson(path.join(source, 'presets', 'react-vite.json'));
  const runtime = readJson(path.join(source, 'runtimes', `${preset.create.runtime}.json`));
  const bin = path.join(base, 'stub-bin');
  const log = path.join(base, 'operations.jsonl');
  fs.mkdirSync(bin);
  // PATH is intentionally isolated: an installed global pnpm cannot defeat the
  // missing-pnpm branch. Both npm and pnpm stubs use the selected real Node.
  fs.symlinkSync(NODE, path.join(bin, 'node'));
  const stub = `#!${NODE}
const fs = require('node:fs');
const path = require('node:path');
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.KIT_TEST_LOG, JSON.stringify({ tool, args, cwd: process.cwd() }) + '\\n');
if (tool === 'pnpm' && args[0] === '--version') {
  console.log(process.env.KIT_TEST_PNPM_VERSION);
  process.exit(0);
}
let command = args;
if (tool === 'npm') {
  const separator = args.indexOf('--');
  if (args[0] !== 'exec' || separator < 0 || args[separator + 1] !== 'pnpm') {
    console.error('unexpected npm invocation');
    process.exit(31);
  }
  command = args.slice(separator + 2);
}
const stage = command[0] === 'run' ? command[1] : command[0];
if (stage === process.env.KIT_TEST_FAIL_STAGE) {
  console.error('stubbed ' + stage + ' failure');
  process.exit(37);
}
if (command[0] === 'run') {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.scripts?.[command[1]]) {
    console.error('missing script: ' + command[1]);
    process.exit(38);
  }
}
`;
  for (const tool of missingPnpm ? ['npm'] : ['pnpm', 'npm']) {
    fs.writeFileSync(path.join(bin, tool), stub, { mode: 0o755 });
  }
  return {
    base,
    source,
    log,
    runtime,
    preset,
    env: {
      ...CHILD_ENV,
      PATH: [bin, '/usr/bin', '/bin'].join(path.delimiter),
      KIT_TEST_LOG: log,
      KIT_TEST_PNPM_VERSION: pnpmVersion || runtime.pnpm,
      KIT_TEST_FAIL_STAGE: failStage || '',
    },
  };
}

function assertNoOperations(fixture, message) {
  assert(operations(fixture).length === 0, `${message}: invoked a package manager`);
}

function assertGeneratedProject(directory, runtime, name) {
  const pkg = readJson(path.join(directory, 'package.json'));
  assert(
    pkg.name === name && pkg.private === true && pkg.version === '0.1.0',
    'project identity defaults are wrong',
  );
  assert(pkg.engines.node === runtime.nodeRange, 'Node engines differ from the runtime contract');
  assert(
    pkg.packageManager === `pnpm@${runtime.pnpm}`,
    'package manager differs from the runtime contract',
  );
  assert(
    fs.readFileSync(path.join(directory, '.node-version'), 'utf8').trim() === runtime.node,
    'Node version file differs from runtime',
  );
  for (const script of [
    'dev',
    'build',
    'preview',
    'test',
    'verify',
    'typecheck',
    'lint',
    'format',
    'format:check',
  ]) {
    assert(
      typeof pkg.scripts[script] === 'string' && pkg.scripts[script],
      `missing ${script} command`,
    );
  }
  assert(
    !pkg.scripts.test.includes('passWithNoTests'),
    'starter tests silently pass without collected tests',
  );
  for (const file of [
    'index.html',
    'src/main.tsx',
    'src/App.tsx',
    'src/project.ts',
    'tests/App.test.tsx',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    '.github/workflows/verify.yml',
    'README.md',
    'AGENTS.md',
  ]) {
    assert(fs.existsSync(path.join(directory, file)), `missing runnable-project file: ${file}`);
  }
  const tsconfig = readJson(path.join(directory, 'tsconfig.json'));
  assert(
    tsconfig.include.some((entry) => entry === 'src' || entry.startsWith('src/')),
    'TypeScript does not include the starter source',
  );
  assert(
    tsconfig.compilerOptions.paths['@/*'].some((entry) => entry.includes('src')),
    'application aliases do not point at the starter source',
  );
  assert(
    fs.readFileSync(path.join(directory, 'index.html'), 'utf8').includes('/src/main.tsx'),
    'HTML entry does not load the app',
  );
  const test = fs.readFileSync(path.join(directory, 'tests', 'App.test.tsx'), 'utf8');
  assert(
    /\b(?:it|test)\s*\(/.test(test) && test.includes('App'),
    'starter contains no actual application test',
  );
  const workflow = fs.readFileSync(
    path.join(directory, '.github', 'workflows', 'verify.yml'),
    'utf8',
  );
  for (const marker of [
    runtime.node,
    runtime.pnpm,
    runtime.runner,
    '--frozen-lockfile',
    'verify',
  ]) {
    assert(workflow.includes(marker), `CI is missing runtime/verification contract: ${marker}`);
  }
  for (const file of filesWithin(directory, ['node_modules', '.git', 'dist'])) {
    assert(
      !/\{\{[a-zA-Z][^}]*\}\}/.test(fs.readFileSync(file, 'utf8')),
      `unrendered token in ${path.relative(directory, file)}`,
    );
  }
  assert(
    !fs.existsSync(path.join(directory, 'apps')) &&
      !fs.existsSync(path.join(directory, 'turbo.json')),
    'single-package recipe unexpectedly requires a workspace',
  );
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, message: error.stack || error.message });
    console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`);
  }
}

async function fastChecks() {
  await check('unsupported Node runtimes fail before writing or invoking package managers', () => {
    const f = fixture('unsupported-node');
    for (const version of ['23.0.0', '24.14.0', '25.0.0']) {
      const target = path.join(f.base, `unsupported-${version}`);
      const driver = `Object.defineProperty(process.versions, 'node', { value: ${JSON.stringify(version)} }); process.argv = ${JSON.stringify([NODE, path.join(f.source, 'kit'), 'create', 'react-vite', target])}; require(${JSON.stringify(path.join(f.source, 'kit'))});`;
      failed(
        run(NODE, ['-e', driver], { cwd: f.base, env: f.env }),
        /Node.*required/,
        'unsupported runtime was accepted',
      );
      assert(!fs.existsSync(target), 'unsupported runtime wrote project files');
      assert(operations(f).length === 0, 'unsupported runtime invoked a package manager');
    }
  });
  console.log('\nRunnable project creation — fast tier');
  await check(
    'dry run describes creation without creating missing ancestors or probing package managers',
    () => {
      const f = fixture('dry-run');
      const parent = path.join(f.base, 'not-created', 'nested');
      const target = path.join(parent, 'example');
      const before = snapshot(f.base);
      const result = runKit(f, ['create', 'react-vite', target, '--name', 'example', '--dry-run']);
      succeeded(result, 'dry run failed');
      assert(/Dry run: create/.test(output(result)), 'dry run is not labelled');
      assert(
        output(result).includes('src/main.tsx'),
        'dry run does not expose planned project files',
      );
      assert(
        snapshot(f.base) === before && !fs.existsSync(parent),
        'dry run changed the filesystem',
      );
      assertNoOperations(f, 'dry run');
    },
  );

  for (const state of ['missing', 'empty', 'git-directory', 'git-file']) {
    await check(`creates a verified single-package app in a ${state} destination`, () => {
      const f = fixture(`destination-${state}`);
      const target = path.join(f.base, 'starter');
      if (state !== 'missing') fs.mkdirSync(target);
      if (state === 'git-directory') {
        fs.mkdirSync(path.join(target, '.git'));
        fs.writeFileSync(path.join(target, '.git', 'preserved'), 'existing git data');
      }
      if (state === 'git-file')
        fs.writeFileSync(path.join(target, '.git'), 'gitdir: /a/user-owned/worktree\n');
      const result = runKit(f, ['create', 'react-vite', target, '--name', 'starter-app']);
      succeeded(result, 'creation failed');
      assert(
        /Project created and verified/.test(output(result)),
        'creation did not report verification',
      );
      assertGeneratedProject(target, f.runtime, 'starter-app');
      if (state === 'git-directory')
        assert(
          fs.readFileSync(path.join(target, '.git', 'preserved'), 'utf8') === 'existing git data',
          'git data changed',
        );
      if (state === 'git-file')
        assert(
          fs.readFileSync(path.join(target, '.git'), 'utf8') === 'gitdir: /a/user-owned/worktree\n',
          'worktree link changed',
        );
      const commands = operations(f).map((entry) => `${entry.tool} ${entry.args.join(' ')}`);
      assert(
        JSON.stringify(commands) ===
          JSON.stringify([
            'pnpm --version',
            'pnpm install --no-frozen-lockfile',
            'pnpm run format',
            'pnpm run verify',
          ]),
        `unexpected command sequence: ${commands.join('; ')}`,
      );
    });
  }

  await check('invalid input fails before target creation and package-manager execution', () => {
    const f = fixture('invalid-input');
    fs.writeFileSync(
      path.join(f.source, 'presets', 'config-only.json'),
      JSON.stringify({ modules: ['git'] }),
    );
    const target = path.join(f.base, 'uncreated', 'starter');
    for (const args of [
      ['create'],
      ['create', 'react-vite'],
      ['create', 'unknown', target],
      ['create', 'config-only', target],
      ['create', 'react-vite', target, '--unknown'],
      ['create', 'react-vite', target, 'extra'],
      ['create', 'react-vite', target, '--name'],
      ['create', 'react-vite', target, '--name', 'valid', '--name', 'again'],
      ['create', 'react-vite', target, '--dry-run', '--dry-run'],
      ...['BadName', 'bad name', '@scope/app', '.bad', '-bad', 'bad/../name', 'bad;echo'].map(
        (name) => ['create', 'react-vite', target, '--name', name],
      ),
    ]) {
      failed(runKit(f, args), null, `accepted invalid arguments ${JSON.stringify(args)}`);
      assert(!fs.existsSync(path.dirname(target)), 'invalid input created a destination ancestor');
      assertNoOperations(f, 'invalid input');
    }
  });

  await check('nonempty destinations, files and symlink paths are preserved and rejected', () => {
    const f = fixture('unsafe-destinations');
    const nonempty = path.join(f.base, 'nonempty');
    fs.mkdirSync(nonempty);
    fs.writeFileSync(path.join(nonempty, 'keep.txt'), 'user data');
    const file = path.join(f.base, 'destination-file');
    fs.writeFileSync(file, 'user file');
    const real = path.join(f.base, 'real');
    fs.mkdirSync(real);
    const link = path.join(f.base, 'linked');
    fs.symlinkSync(real, link);
    const gitLink = path.join(f.base, 'git-linked');
    fs.mkdirSync(gitLink);
    fs.symlinkSync(real, path.join(gitLink, '.git'));
    const before = snapshot(f.base);
    for (const target of [nonempty, file, link, path.join(link, 'child'), gitLink]) {
      failed(
        runKit(f, ['create', 'react-vite', target]),
        /empty|symlink|symbolic|directory|destination/i,
        'unsafe destination accepted',
      );
      assert(snapshot(f.base) === before, 'rejected destination changed the filesystem');
      assertNoOperations(f, 'rejected destination');
    }
  });

  for (const availability of ['missing', 'wrong-version']) {
    await check(`uses exact npm pnpm fallback when global pnpm is ${availability}`, () => {
      const f = fixture(`fallback-${availability}`, {
        missingPnpm: availability === 'missing',
        pnpmVersion: '0.0.1',
      });
      const result = runKit(f, ['create', 'react-vite', path.join(f.base, 'fallback-app')]);
      succeeded(result, 'fallback failed');
      const npm = operations(f).filter((entry) => entry.tool === 'npm');
      assert(
        npm.length === 3,
        `expected install, format and verify fallback, got ${JSON.stringify(npm)}`,
      );
      for (const entry of npm) {
        assert(
          JSON.stringify(entry.args.slice(0, 5)) ===
            JSON.stringify(['exec', '--yes', `--package=pnpm@${f.runtime.pnpm}`, '--', 'pnpm']),
          'npm fallback does not pin the exact recipe package manager',
        );
      }
      assert(
        JSON.stringify(npm.map((entry) => entry.args.slice(5))) ===
          JSON.stringify([
            ['install', '--no-frozen-lockfile'],
            ['run', 'format'],
            ['run', 'verify'],
          ]),
        'fallback command order is wrong',
      );
    });
  }

  for (const stage of ['install', 'verify']) {
    await check(
      `${stage} failure preserves generated project and reports recovery without success`,
      () => {
        const f = fixture(`failure-${stage}`, { failStage: stage });
        const target = path.join(f.base, 'recoverable-app');
        const result = runKit(f, ['create', 'react-vite', target]);
        failed(result, /Creation failed/, `${stage} failure was hidden`);
        assert(
          /Recovery commands/.test(output(result)) && output(result).includes(target),
          'failure omits actionable recovery location',
        );
        assert(
          output(result).includes('install') && output(result).includes('verify'),
          'failure omits recovery commands',
        );
        assert(
          !/Project created and verified/.test(output(result)),
          'failed creation claimed success',
        );
        assertGeneratedProject(target, f.runtime, 'recoverable-app');
      },
    );
  }

  await check(
    'legacy init dry run preserves an existing package and performs no operations',
    () => {
      const f = fixture('init-dry-run');
      const project = path.join(f.base, 'existing');
      fs.mkdirSync(project);
      writeJson(path.join(project, 'package.json'), {
        name: 'existing',
        private: true,
        scripts: { custom: 'echo retained' },
      });
      const before = snapshot(project);
      succeeded(
        runKit(f, ['init', 'react-vite', '--dry-run'], { cwd: project }),
        'init dry run failed',
      );
      assert(snapshot(project) === before, 'legacy init dry run changed project');
      assertNoOperations(f, 'legacy init dry run');
    },
  );

  const metadataCases = [
    [
      'unknown module dependency',
      (f) =>
        writeJson(path.join(f.source, 'modules/quality/module.json'), {
          requires: ['missing-module'],
        }),
      /missing-module|unknown/i,
    ],
    [
      'cyclic module dependency',
      (f) => {
        writeJson(path.join(f.source, 'modules/quality/module.json'), { requires: ['typescript'] });
        writeJson(path.join(f.source, 'modules/typescript/module.json'), { requires: ['quality'] });
      },
      /cycle|cyclic/i,
    ],
    [
      'undeclared file collision',
      (f) => {
        const directory = path.join(f.source, 'modules/conflict/files/src');
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'App.tsx'), 'incompatible application');
        writeJson(path.join(f.source, 'modules/conflict/module.json'), { requires: [] });
        f.preset.create.modules.push('conflict');
        writeJson(path.join(f.source, 'presets/react-vite.json'), f.preset);
      },
      /conflict|collision|override|overwrite/i,
    ],
    [
      'undeclared package field collision',
      (f) => {
        writeJson(path.join(f.source, 'modules/conflict/module.json'), { requires: [] });
        writeJson(path.join(f.source, 'modules/conflict/package.json.snippet'), {
          scripts: { dev: 'echo incompatible' },
        });
        f.preset.create.modules.push('conflict');
        writeJson(path.join(f.source, 'presets/react-vite.json'), f.preset);
      },
      /conflict|collision|override|overwrite/i,
    ],
    [
      'unknown template token',
      (f) =>
        fs.writeFileSync(
          path.join(f.source, f.preset.create.template, 'files/unknown-token.txt'),
          '{{notSupported}}\n',
        ),
      /token|placeholder|notSupported/i,
    ],
  ];
  for (const [name, mutate, diagnostic] of metadataCases) {
    await check(`${name} fails during composition before any project writes`, () => {
      const f = fixture('metadata');
      mutate(f);
      const target = path.join(f.base, 'not-created', 'starter');
      failed(runKit(f, ['create', 'react-vite', target]), diagnostic, name);
      assert(
        !fs.existsSync(path.dirname(target)),
        'invalid metadata created destination ancestors',
      );
      assertNoOperations(f, 'invalid metadata');
    });
  }

  await check(
    'transitive dependencies appear before consumers and are composed exactly once',
    () => {
      const f = fixture('transitive');
      writeJson(path.join(f.source, 'modules/foundation/module.json'), { requires: [] });
      fs.mkdirSync(path.join(f.source, 'modules/foundation/files'), { recursive: true });
      fs.writeFileSync(
        path.join(f.source, 'modules/foundation/files/foundation.txt'),
        'foundation\n',
      );
      writeJson(path.join(f.source, 'modules/quality/module.json'), { requires: ['foundation'] });
      writeJson(path.join(f.source, 'modules/typescript/module.json'), {
        requires: ['foundation'],
      });
      const target = path.join(f.base, 'transitive-app');
      const preview = runKit(f, ['create', 'react-vite', target, '--dry-run']);
      succeeded(preview, 'transitive dry run failed');
      const modules = output(preview)
        .split('\n')
        .find((line) => /modules:/i.test(line));
      assert(
        modules &&
          modules.indexOf('foundation') < modules.indexOf('quality') &&
          modules.indexOf('foundation') < modules.indexOf('typescript'),
        'dependency order is not visible or incorrect',
      );
      assert(
        (modules.match(/foundation/g) || []).length === 1,
        'shared transitive dependency appears more than once',
      );
      succeeded(runKit(f, ['create', 'react-vite', target]), 'transitive creation failed');
      assert(
        fs.readFileSync(path.join(target, 'foundation.txt'), 'utf8') === 'foundation\n',
        'transitive files were omitted',
      );
    },
  );
}

function npmExecutable() {
  const sibling = path.join(path.dirname(NODE), process.platform === 'win32' ? 'npm.cmd' : 'npm');
  return fs.existsSync(sibling) ? sibling : 'npm';
}

function packageRunner(runtime) {
  const probe = run('pnpm', ['--version']);
  if (probe.status === 0 && probe.stdout.trim() === runtime.pnpm)
    return { command: 'pnpm', prefix: [] };
  return {
    command: npmExecutable(),
    prefix: ['exec', '--yes', `--package=pnpm@${runtime.pnpm}`, '--', 'pnpm'],
  };
}

function runPackage(runner, directory, args, timeout = 300000) {
  return run(runner.command, [...runner.prefix, ...args], { cwd: directory, timeout });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.once('end', () => resolve({ status: response.statusCode, body }));
      response.once('error', reject);
    });
    req.setTimeout(1500, () => req.destroy(new Error('HTTP timeout')));
    req.once('error', reject);
  });
}

async function stopServer(child) {
  const terminate = (signal) => {
    try {
      process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
    } catch {}
  };
  terminate('SIGTERM');
  if (child.exitCode !== null || !child.pid) {
    terminate('SIGKILL');
    return;
  }
  const exited = new Promise((resolve) => child.once('exit', resolve));
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1500))]);
  // The package runner can exit before its Vite descendant; signal the process
  // group again even when the npm parent already exited.
  terminate('SIGKILL');
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1500))]);
}

async function checkServer(runner, directory, script, name) {
  const port = await freePort();
  let log = '';
  const child = spawn(
    runner.command,
    [
      ...runner.prefix,
      'run',
      script,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: directory,
      env: CHILD_ENV,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (chunk) => {
    log = (log + chunk).slice(-10000);
  });
  child.stderr.on('data', (chunk) => {
    log = (log + chunk).slice(-10000);
  });
  let spawnError;
  child.once('error', (error) => {
    spawnError = error;
  });
  try {
    const deadline = Date.now() + 45000;
    let page;
    while (Date.now() < deadline && !spawnError && child.exitCode === null) {
      try {
        page = await request(`http://127.0.0.1:${port}/`);
        if (page.status === 200) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert(page?.status === 200, `${script} did not serve the app\n${spawnError || ''}\n${log}`);
    assert(
      page.body.includes(name) && /id=["']root["']/.test(page.body),
      `${script} served incorrect HTML`,
    );
    const asset =
      script === 'dev' ? '/src/main.tsx' : page.body.match(/<script[^>]+src=["']([^"']+)["']/)?.[1];
    assert(asset, `${script} does not expose an application entry`);
    const source = await request(new URL(asset, `http://127.0.0.1:${port}/`).href);
    assert(
      source.status === 200 && source.body.length > 0,
      `${script} application entry cannot load`,
    );
    const occupied = runPackage(runner, directory, ['run', script, '--port', String(port)], 30000);
    failed(
      occupied,
      /already in use|EADDRINUSE/i,
      `${script} did not reject an occupied port using its default strict-port setting`,
    );
  } finally {
    await stopServer(child);
  }
}

async function fullChecks() {
  console.log('\nRunnable project creation — packed npm integration');
  let fullRoot;
  if (process.env.KIT_CREATE_TEST_KEEP_DIR) {
    fs.mkdirSync(path.resolve(process.env.KIT_CREATE_TEST_KEEP_DIR), { recursive: true });
    fullRoot = fs.mkdtempSync(
      path.join(
        fs.realpathSync(path.resolve(process.env.KIT_CREATE_TEST_KEEP_DIR)),
        'kit-create-full-',
      ),
    );
  } else {
    fullRoot = fs.mkdtempSync(path.join(TEMP, 'full-'));
  }
  const projects = [];
  try {
    await check('packed CLI includes the creation engine, metadata and templates', () => {
      const packed = run(
        npmExecutable(),
        ['pack', '--silent', '--ignore-scripts', '--pack-destination', fullRoot],
        { timeout: 120000 },
      );
      succeeded(packed, 'npm pack failed');
      const archives = fs.readdirSync(fullRoot).filter((name) => name.endsWith('.tgz'));
      assert(archives.length === 1, 'npm pack did not emit one tarball');
      const installer = path.join(fullRoot, 'launcher');
      fs.mkdirSync(installer);
      writeJson(path.join(installer, 'package.json'), {
        name: 'kit-packed-launcher',
        private: true,
      });
      succeeded(
        run(
          npmExecutable(),
          [
            'install',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--package-lock=false',
            path.join(fullRoot, archives[0]),
          ],
          { cwd: installer, timeout: 120000 },
        ),
        'packed CLI installation failed',
      );
      const manifest = readJson(path.join(ROOT, 'package.json'));
      const source = path.join(installer, 'node_modules', ...manifest.name.split('/'));
      assert(
        fs.existsSync(path.join(source, 'kit')) &&
          fs.existsSync(path.join(source, 'lib', 'project-plan.js')),
        'tarball omits the CLI creation engine',
      );
      const preset = readJson(path.join(source, 'presets/react-vite.json'));
      const runtime = readJson(path.join(source, 'runtimes', `${preset.create.runtime}.json`));
      for (const name of ['kit-full-alpha', 'kit-full-beta']) {
        projects.push({
          source,
          base: fullRoot,
          env: CHILD_ENV,
          runtime,
          name,
          target: path.join(fullRoot, name),
        });
      }
    });
    for (const project of projects) {
      await check(`packed CLI creates and verifies ${project.name}`, () => {
        const result = runKit(project, ['create', 'react-vite', project.target], {
          timeout: 600000,
        });
        succeeded(result, 'packed project creation failed');
        assert(
          /Project created and verified/.test(output(result)),
          'packed creation did not report verified result',
        );
        assertGeneratedProject(project.target, project.runtime, project.name);
        assert(
          fs.existsSync(path.join(project.target, 'pnpm-lock.yaml')),
          'real install did not create a lockfile',
        );
      });
      if (!fs.existsSync(path.join(project.target, 'pnpm-lock.yaml'))) continue;
      const runner = packageRunner(project.runtime);
      await check(`${project.name} passes frozen-lockfile installation and verification`, () => {
        const lockfile = fs.readFileSync(path.join(project.target, 'pnpm-lock.yaml'), 'utf8');
        succeeded(
          runPackage(runner, project.target, ['install', '--frozen-lockfile']),
          'frozen-lockfile installation failed',
        );
        assert(
          fs.readFileSync(path.join(project.target, 'pnpm-lock.yaml'), 'utf8') === lockfile,
          'frozen installation rewrote its lockfile',
        );
        const sourceBefore = snapshot(project.target, ['node_modules', 'dist']);
        succeeded(
          runPackage(runner, project.target, ['run', 'verify']),
          'CI-equivalent verification failed',
        );
        assert(
          snapshot(project.target, ['node_modules', 'dist']) === sourceBefore,
          'verification rewrote project source or configuration',
        );
      });
      await check(
        `${project.name} detects real TypeScript and test failures, then recovers`,
        () => {
          const typeFile = path.join(project.target, 'src', 'kit-negative-type.ts');
          const testFile = path.join(project.target, 'tests', 'kit-negative.test.ts');
          try {
            fs.writeFileSync(typeFile, "export const invalidType: number = 'expected failure';\n");
            failed(
              runPackage(runner, project.target, ['run', 'typecheck']),
              /TS2322|not assignable/,
              'TypeScript missed a source error',
            );
            fs.rmSync(typeFile);
            fs.writeFileSync(
              testFile,
              "import { expect, it } from 'vitest';\nit('rejects an intentional failure', () => expect(true).toBe(false));\n",
            );
            failed(
              runPackage(runner, project.target, ['run', 'test']),
              /rejects an intentional failure|AssertionError/,
              'test command missed a failing test',
            );
          } finally {
            fs.rmSync(typeFile, { force: true });
            fs.rmSync(testFile, { force: true });
          }
          succeeded(
            runPackage(runner, project.target, ['run', 'verify']),
            'project did not recover after removing intentionally failing files',
          );
        },
      );
      await check(`${project.name} serves its source app and built preview`, async () => {
        await checkServer(runner, project.target, 'dev', project.name);
        await checkServer(runner, project.target, 'preview', project.name);
      });
    }
  } finally {
    if (process.env.KIT_CREATE_TEST_KEEP_DIR) {
      console.log(`\nFull projects retained: ${fullRoot}`);
      for (const project of projects) console.log(`  ${project.target}`);
    }
  }
}

(async () => {
  try {
    await fastChecks();
    if (FULL) await fullChecks();
  } catch (error) {
    failures.push({ name: 'test harness', message: error.stack || error.message });
  } finally {
    fs.rmSync(TEMP, { recursive: true, force: true });
  }
  console.log(
    `\nCreate tests: ${passed} passed, ${failures.length} failed${FULL ? '' : ' (fast tier)'}`,
  );
  for (const failure of failures) console.error(`\n${failure.name}\n${failure.message}`);
  process.exitCode = failures.length ? 1 : 0;
})();
