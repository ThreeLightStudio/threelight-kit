#!/usr/bin/env node
/**
 * P1 recipe integration checks.
 *
 * Default: portable, offline CLI fixtures and package-manager stubs.
 * --full: npm-packed CLI, real node-ts/web-api checks and local processes.
 * --desktop: with --full, add the unsigned native build on supported hardware.
 * --desktop-run: also launch the native development app briefly; UI acceptance
 * remains a separate human check.
 * KIT_CREATE_TEST_NODE selects the supported Node executable.
 * KIT_P1_TEST_KEEP_DIR retains projects beneath a unique full-run directory.
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
const DESKTOP = process.argv.includes('--desktop');
const DESKTOP_RUN = process.argv.includes('--desktop-run');
const CHILD_ENV = {
  ...process.env,
  PATH: `${path.dirname(NODE)}${path.delimiter}${process.env.PATH || ''}`,
};
const TEMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-p1-tests-')));
const PROCESSES = new Set();
const SOURCE_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  '.cache',
  '.turbo',
  '.hutch',
  '.cottontail-tmp',
];
const RECIPES = ['node-ts', 'web-api', 'desktop-react'];
let passed = 0;
let skipped = 0;
const failures = [];

function assert(value, message) {
  if (!value) throw new Error(message);
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
    `${message}\n${output(result).slice(-7000)}\n${result.error || ''}`,
  );
}

function failed(result, pattern, message) {
  assert(result.status !== 0 && !result.error, `${message}: expected failure\n${output(result)}`);
  if (pattern)
    assert(pattern.test(output(result)), `${message}: missing ${pattern}\n${output(result)}`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    env: CHILD_ENV,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 12 * 1024 * 1024,
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

function walk(directory, excluded = []) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && excluded.includes(entry.name)) return [];
    return entry.isDirectory() ? walk(file, excluded) : [file];
  });
}

function snapshot(directory, excluded = SOURCE_EXCLUDES) {
  return JSON.stringify(
    walk(directory, excluded)
      .map((file) => [
        path.relative(directory, file),
        fs.lstatSync(file).isSymbolicLink()
          ? `link:${fs.readlinkSync(file)}`
          : fs.readFileSync(file).toString('base64'),
      ])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}

function fixture(label, { pathOnly = false } = {}) {
  const base = fs.mkdtempSync(path.join(TEMP, `${label}-`));
  const source = path.join(base, 'kit-source');
  fs.cpSync(ROOT, source, {
    recursive: true,
    filter: (file) =>
      !path
        .relative(ROOT, file)
        .split(path.sep)
        .some((part) => ['.git', 'node_modules', 'work'].includes(part)),
  });
  const bin = path.join(base, 'stub-bin');
  const log = path.join(base, 'operations.jsonl');
  fs.mkdirSync(bin);
  fs.symlinkSync(NODE, path.join(bin, 'node'));
  const stub = `#!${NODE}
const fs = require('node:fs');
const path = require('node:path');
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.KIT_P1_LOG, JSON.stringify({tool,args})+'\\n');
if(tool==='pnpm' && args[0]==='--version'){console.log('10.33.2');process.exit(0);}
const command = tool==='npm' ? args.slice(args.indexOf('--')+2) : args;
if(command[0]==='run'){
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 if(!pkg.scripts?.[command[1]]){console.error('Missing script');process.exit(37);}
}
`;
  for (const tool of ['pnpm', 'npm']) fs.writeFileSync(path.join(bin, tool), stub, { mode: 0o755 });
  return {
    base,
    source,
    bin,
    log,
    env: {
      ...CHILD_ENV,
      PATH: [bin, ...(pathOnly ? [] : ['/usr/bin', '/bin'])].join(path.delimiter),
      KIT_P1_LOG: log,
    },
  };
}

function operations(fixture) {
  return fs.existsSync(fixture.log)
    ? fs.readFileSync(fixture.log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
    : [];
}

function runtimeFor(source, recipe) {
  const preset = readJson(path.join(source, 'presets', `${recipe}.json`));
  return readJson(path.join(source, 'runtimes', `${preset.create.runtime}.json`));
}

function commandAvailable(command, searchPath = CHILD_ENV.PATH) {
  return searchPath.split(path.delimiter).some((directory) => {
    try {
      fs.accessSync(path.join(directory, command), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function assertManifest(target, recipe, name, runtime) {
  const pkg = readJson(path.join(target, 'package.json'));
  assert(
    pkg.name === name && pkg.version === '0.1.0' && pkg.private === true,
    'Generated identity differs from recipe defaults',
  );
  assert(
    pkg.packageManager === `pnpm@${runtime.pnpm}` && pkg.engines.node === runtime.nodeRange,
    'Runtime manifest differs from metadata',
  );
  assert(
    pkg.scripts.test === 'vitest run' && pkg.scripts.verify.includes('build'),
    'Verification omits collected tests or production build',
  );
  const sourceFiles = walk(target, SOURCE_EXCLUDES);
  for (const file of sourceFiles)
    assert(
      !/\{\{[a-zA-Z][^}]*\}\}/.test(fs.readFileSync(file, 'utf8')),
      `Unrendered token: ${file}`,
    );
  if (recipe === 'node-ts') {
    const compiler = readJson(path.join(target, 'tsconfig.json')).compilerOptions;
    assert(
      compiler.module === 'NodeNext' && compiler.moduleResolution === 'NodeNext',
      'Node starter does not use NodeNext ESM',
    );
    assert(
      !compiler.jsx && !compiler.lib.some((value) => /DOM/i.test(value)),
      'Node starter includes browser/JSX configuration',
    );
    for (const dependency of ['react', 'react-dom', 'vite', '@vitejs/plugin-react'])
      assert(
        !pkg.dependencies?.[dependency] && !pkg.devDependencies?.[dependency],
        `Unexpected browser dependency ${dependency}`,
      );
    assert(
      fs.existsSync(path.join(target, 'tsconfig.build.json')) &&
        fs.existsSync(path.join(target, 'tests/greeting.test.ts')),
      'Node starter omits build profile or behavior test',
    );
  } else {
    assert(
      fs.existsSync(path.join(target, 'apps/web/index.html')),
      'Workspace web entry is missing',
    );
    if (recipe === 'web-api')
      assert(
        fs.existsSync(path.join(target, 'apps/server/src/index.ts')) &&
          fs.existsSync(path.join(target, 'packages/contracts/package.json')),
        'Web/API ownership boundaries are missing',
      );
    if (recipe === 'desktop-react') {
      const config = fs.readFileSync(path.join(target, 'electrobun.config.ts'), 'utf8');
      const profile = fs.readFileSync(path.join(target, 'apps/desktop/build-profile.ts'), 'utf8');
      const watch = config.match(/watch:\s*\[([^\]]*)\]/)?.[1] ?? '';
      const watchIgnore = config.match(/watchIgnore:\s*\[([^\]]*)\]/)?.[1] ?? '';
      assert(
        /['"]\.cache\/\*\*['"]/.test(watchIgnore),
        'Desktop development watches its own generated cache and can loop rebuilding',
      );
      assert(
        /['"]apps\/web['"]/.test(watch) && /['"]apps\/desktop['"]/.test(watch),
        'Desktop development does not watch both web and native source',
      );
      assert(
        /codesign:\s*false/.test(config) && /notarize:\s*false/.test(config),
        'Desktop startup unexpectedly requires release signing',
      );
      assert(
        !/release\.baseUrl|releases\/latest\/download/.test(config),
        'Development desktop config contains a release destination',
      );
      assert(
        profile.includes(`com.threelight.${name.replace(/[._]/g, '-')}`),
        'Native identity is not deterministically project-specific',
      );
      assert(
        !pkg.scripts['desktop:build:stable'] && !pkg.scripts['desktop:config:stable'],
        'Development starter exposes inherited stable-release commands',
      );
    }
  }
  return pkg;
}

async function check(name, test) {
  try {
    await test();
    passed++;
    console.log(`  ✓ ${name}`);
    return true;
  } catch (error) {
    failures.push({ name, message: error.stack || error.message });
    console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`);
    return false;
  }
}

function skip(message) {
  skipped++;
  console.log(`  - ${message}`);
}

async function fastChecks() {
  console.log('\nP1 recipes — portable offline checks');
  for (const recipe of RECIPES)
    await check(`${recipe} dry run composes files/settings/steps without side effects`, () => {
      const f = fixture(`dry-${recipe}`);
      const before = snapshot(f.base, []);
      const target = path.join(f.base, 'missing-parent', `${recipe}-demo`);
      const result = runKit(f, ['create', recipe, target, '--dry-run']);
      succeeded(result, 'Recipe dry run failed');
      const text = output(result);
      for (const marker of [
        'Files:',
        'Package settings:',
        'Steps',
        'format',
        'verify',
        'package.json',
      ])
        assert(text.includes(marker), `Dry run omitted ${marker}`);
      assert(
        snapshot(f.base, []) === before && !fs.existsSync(path.dirname(target)),
        'Dry run changed filesystem state',
      );
      assert(!operations(f).length, 'Dry run probed or invoked package managers');
    });
  for (const recipe of ['node-ts', 'web-api'])
    await check(`${recipe} stub creation composes a runnable recipe`, () => {
      const f = fixture(`create-${recipe}`);
      const target = path.join(f.base, `${recipe}-demo`);
      succeeded(runKit(f, ['create', recipe, target]), 'Stub creation failed');
      assertManifest(target, recipe, `${recipe}-demo`, runtimeFor(f.source, recipe));
      const commands = operations(f)
        .filter((entry) => entry.args[0] !== '--version')
        .map((entry) => entry.args);
      assert(
        JSON.stringify(commands) ===
          JSON.stringify([
            ['install', '--no-frozen-lockfile'],
            ['run', 'format'],
            ['run', 'verify'],
          ]),
        'Creation did not install/format/verify in order',
      );
    });
  for (const recipe of ['node-ts', 'web-api'])
    await check(`${recipe} cannot silently apply its create-only profile through init`, () => {
      const f = fixture(`init-${recipe}`);
      const target = path.join(f.base, 'empty-project');
      fs.mkdirSync(target);
      failed(
        runKit(f, ['init', recipe], { cwd: target }),
        /creat|configuration|init/i,
        'Create-only preset was accepted by init',
      );
      assert(
        fs.readdirSync(target).length === 0 && !operations(f).length,
        'Rejected init mutated the project',
      );
    });
  await check('native platform and architecture rejection occurs before writes', () => {
    const f = fixture('native-rejection');
    for (const [platform, architecture] of [
      ['linux', 'arm64'],
      ['darwin', 'x64'],
    ]) {
      const target = path.join(f.base, `${platform}-${architecture}`);
      const driver = `Object.defineProperty(process,'platform',{value:${JSON.stringify(platform)}});Object.defineProperty(process,'arch',{value:${JSON.stringify(architecture)}});process.argv=${JSON.stringify([NODE, path.join(f.source, 'kit'), 'create', 'desktop-react', target])};require(${JSON.stringify(path.join(f.source, 'kit'))});`;
      failed(
        run(NODE, ['-e', driver], { cwd: f.base, env: f.env }),
        /requires.*darwin|requires.*arm64|platform|architecture/i,
        'Unsupported native runtime was accepted',
      );
      assert(
        !fs.existsSync(target) && !operations(f).length,
        'Native runtime rejection happened after mutation',
      );
    }
  });
  await check('a missing declared executable is rejected before writing', () => {
    const f = fixture('missing-command', { pathOnly: true });
    const preset = readJson(path.join(f.source, 'presets/node-ts.json'));
    const file = path.join(f.source, 'runtimes', `${preset.create.runtime}.json`);
    const runtime = readJson(file);
    runtime.commands = ['kit-p1-missing-command'];
    writeJson(file, runtime);
    const target = path.join(f.base, 'not-created');
    failed(
      runKit(f, ['create', 'node-ts', target]),
      /kit-p1-missing-command|missing.*command|prerequisite/i,
      'Missing executable was accepted',
    );
    assert(
      !fs.existsSync(target) && !operations(f).length,
      'Executable preflight happened after writing',
    );
  });
  if (process.platform !== 'win32')
    await check(
      'web supervisor survives repeated signals and cleans both detached child groups',
      async () => {
        const base = fs.mkdtempSync(path.join(TEMP, 'web-repeated-signal-'));
        const selected = await ports();
        fs.mkdirSync(path.join(base, 'scripts'), { recursive: true });
        for (const file of ['dev.mjs', 'runtime-config.mjs'])
          fs.copyFileSync(
            path.join(ROOT, 'templates/web-api/files/scripts', file),
            path.join(base, 'scripts', file),
          );
        writeJson(path.join(base, 'package.json'), {
          name: 'signal-demo',
          version: '0.1.0',
          type: 'module',
        });
        writeJson(path.join(base, 'node_modules/tsx/package.json'), {
          name: 'tsx',
          type: 'module',
          exports: './index.js',
        });
        fs.writeFileSync(path.join(base, 'node_modules/tsx/index.js'), 'export {};\n');
        writeJson(path.join(base, 'node_modules/vite/package.json'), {
          name: 'vite',
          type: 'commonjs',
        });
        fs.mkdirSync(path.join(base, 'apps/server/src'), { recursive: true });
        fs.mkdirSync(path.join(base, 'node_modules/vite/bin'), { recursive: true });
        const apiPidFile = path.join(base, 'api.pid');
        const webPidFile = path.join(base, 'web.pid');
        fs.writeFileSync(
          path.join(base, 'apps/server/src/index.ts'),
          `
import http from 'node:http';
import fs from 'node:fs';
process.on('SIGTERM',()=>{});
process.on('SIGINT',()=>{});
fs.writeFileSync(${JSON.stringify(apiPidFile)},String(process.pid));
http.createServer((request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ready:true,name:'signal-demo',version:'0.1.0'}));}).listen(Number(process.env.API_PORT),'127.0.0.1');
`,
        );
        fs.writeFileSync(
          path.join(base, 'node_modules/vite/bin/vite.js'),
          `
const http=require('node:http');
const fs=require('node:fs');
process.on('SIGTERM',()=>{});
process.on('SIGINT',()=>{});
fs.writeFileSync(${JSON.stringify(webPidFile)},String(process.pid));
http.createServer((request,response)=>response.end('web-ready')).listen(Number(process.env.WEB_PORT),'127.0.0.1');
`,
        );
        const handle = launch(NODE, [path.join(base, 'scripts/dev.mjs')], base, {
          ...CHILD_ENV,
          ...selected,
        });
        try {
          await waitHealth(handle, selected.API_PORT, 'signal-demo');
          await waitFor(
            async () => {
              try {
                return (
                  (await request(`http://127.0.0.1:${selected.WEB_PORT}/`)).body === 'web-ready'
                );
              } catch {
                return false;
              }
            },
            5000,
            () => `Supervisor did not start its web child\n${handle.log}`,
          );
          handle.child.kill('SIGTERM');
          await delay(30);
          handle.child.kill('SIGTERM');
          await waitFor(
            () => Boolean(handle.outcome),
            6000,
            () => `Repeated-signal shutdown did not finish\n${handle.log}`,
          );
          assert(
            handle.outcome.code === 0,
            `Intentional repeated signals reported failure\n${handle.log}`,
          );
          await assertClosed(selected);
          for (const file of [apiPidFile, webPidFile])
            assert(
              !pidRunning(Number(fs.readFileSync(file, 'utf8'))),
              'Detached child survived intentional repeated signals',
            );
        } finally {
          await stop(handle);
          for (const file of [apiPidFile, webPidFile]) {
            if (!fs.existsSync(file)) continue;
            const pid = Number(fs.readFileSync(file, 'utf8'));
            if (!pidRunning(pid)) continue;
            try {
              process.kill(-pid, 'SIGKILL');
            } catch (error) {
              if (error.code !== 'ESRCH') throw error;
            }
          }
          await assertClosed(selected);
        }
      },
    );
  else skip('POSIX repeated-signal supervisor regression is unavailable on Windows');
  if (process.platform !== 'win32')
    await check(
      'desktop launcher escalates after an immediate child exits and kills its owned stubborn descendant',
      async () => {
        const base = fs.mkdtempSync(path.join(TEMP, 'desktop-escalation-'));
        const executable = path.join(base, 'node_modules/electrobun/bin/electrobun.cjs');
        const descendant = path.join(base, 'stubborn-descendant.cjs');
        const pidFile = path.join(base, 'descendant.pid');
        fs.mkdirSync(path.dirname(executable), { recursive: true });
        fs.writeFileSync(
          descendant,
          `const fs=require('node:fs');process.on('SIGTERM',()=>{});process.on('SIGINT',()=>{});fs.writeFileSync(process.env.KIT_P1_DESCENDANT_PID,String(process.pid));setInterval(()=>{},1000);\n`,
        );
        fs.writeFileSync(
          executable,
          `const {spawn}=require('node:child_process');spawn(process.execPath,[${JSON.stringify(descendant)}],{stdio:'inherit'});process.on('SIGTERM',()=>process.exit(0));process.on('SIGINT',()=>process.exit(0));\n`,
        );
        const handle = launch(
          NODE,
          [path.join(ROOT, 'templates/desktop-react/files/scripts/desktop-dev.mjs')],
          base,
          { ...CHILD_ENV, KIT_P1_DESCENDANT_PID: pidFile },
        );
        let descendantPid;
        try {
          await waitFor(
            () => fs.existsSync(pidFile),
            5000,
            () => `Stub descendant never started\n${handle.log}`,
          );
          descendantPid = Number(fs.readFileSync(pidFile, 'utf8'));
          assert(pidRunning(descendantPid), 'Regression fixture did not create a live descendant');
          handle.child.kill('SIGTERM');
          await waitFor(
            () => !pidRunning(descendantPid),
            6000,
            () => `Owned descendant survived the launcher grace period\n${handle.log}`,
          );
          await waitFor(
            () => Boolean(handle.outcome),
            3000,
            'Desktop launcher did not finish intentional shutdown',
          );
          assert(
            handle.outcome.code === 0,
            `Intentional launcher shutdown reported failure\n${handle.log}`,
          );
        } finally {
          await stop(handle);
          if (descendantPid && pidRunning(descendantPid)) {
            try {
              process.kill(descendantPid, 'SIGKILL');
            } catch (error) {
              if (error.code !== 'ESRCH') throw error;
            }
          }
        }
      },
    );
  else skip('POSIX owned-process-group regression is unavailable on Windows');
  const native = runtimeFor(ROOT, 'desktop-react');
  const selected = run(NODE, [
    '-p',
    'JSON.stringify({platform:process.platform,architecture:process.arch,nodeVersion:process.versions.node})',
  ]);
  succeeded(selected, 'Cannot inspect selected Node runtime');
  const host = JSON.parse(selected.stdout);
  const compatibility = require('../lib/project-plan').runtimeCompatibility(native, host);
  if (compatibility.ok && (native.commands || []).every((command) => commandAvailable(command))) {
    await check('supported native hardware composes an unsigned desktop through stubs', () => {
      const f = fixture('desktop-stub');
      const target = path.join(f.base, 'brand.demo_app');
      succeeded(
        runKit(f, ['create', 'desktop-react', target]),
        'Supported desktop stub creation failed',
      );
      assertManifest(target, 'desktop-react', 'brand.demo_app', native);
    });
  } else {
    await check('current host reports native unavailability without executing native work', () => {
      const f = fixture('desktop-unavailable');
      const target = path.join(f.base, 'not-created');
      failed(
        runKit(f, ['create', 'desktop-react', target]),
        /requires|prerequisite|command/i,
        'Native creation was incorrectly accepted',
      );
      assert(
        !fs.existsSync(target) && !operations(f).length,
        'Unavailable native creation performed work',
      );
    });
  }
}

function npmExecutable() {
  const sibling = path.join(path.dirname(NODE), process.platform === 'win32' ? 'npm.cmd' : 'npm');
  return fs.existsSync(sibling) ? sibling : 'npm';
}

function packageRunner(runtime) {
  return {
    command: npmExecutable(),
    prefix: ['exec', '--yes', `--package=pnpm@${runtime.pnpm}`, '--', 'pnpm'],
  };
}

function runPackage(runner, directory, args, options = {}) {
  return run(runner.command, [...runner.prefix, ...args], {
    cwd: directory,
    timeout: 300000,
    ...options,
  });
}

function launch(command, args, directory, env = CHILD_ENV) {
  const child = spawn(command, args, {
    cwd: directory,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const handle = { child, log: '', outcome: null, error: null };
  handle.closed = new Promise((resolve) => {
    child.once('error', (error) => {
      handle.error = error;
      resolve();
    });
    child.once('close', (code, signal) => {
      handle.outcome = { code, signal };
      resolve();
    });
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => {
      handle.log = (handle.log + chunk).slice(-30000);
    });
  PROCESSES.add(handle);
  return handle;
}

function launchPackage(runner, project, script, env = CHILD_ENV) {
  return launch(runner.command, [...runner.prefix, 'run', script], project, env);
}

function pidRunning(pid) {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
  // A terminated orphan can remain as a zombie briefly while the OS reaps it;
  // it is already unable to execute or own a listening socket.
  if (process.platform === 'linux') {
    try {
      return !/\)\s+Z\s/.test(fs.readFileSync(`/proc/${pid}/stat`, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }
  const status = run('ps', ['-p', String(pid), '-o', 'stat='], { timeout: 1000 });
  if (status.error)
    throw new Error(`Cannot inspect regression descendant: ${status.error.message}`);
  return status.status === 0 && !/^\s*Z/.test(status.stdout);
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(predicate, timeout, message) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(75);
  }
  throw new Error(typeof message === 'function' ? message() : message);
}

async function stop(handle) {
  const signal = (value) => {
    if (!handle.child.pid) return;
    try {
      process.kill(process.platform === 'win32' ? handle.child.pid : -handle.child.pid, value);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  signal('SIGTERM');
  const deadline = Date.now() + 2500;
  while (handle.child.pid && Date.now() < deadline) {
    try {
      process.kill(process.platform === 'win32' ? handle.child.pid : -handle.child.pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') break;
      throw error;
    }
    await delay(75);
  }
  // An exited npm parent does not imply its supervisor and owned descendants
  // have finished their signal grace period.
  signal('SIGKILL');
  await Promise.race([handle.closed, delay(1000)]);
  PROCESSES.delete(handle);
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
    req.setTimeout(1000, () => req.destroy(new Error('HTTP timeout')));
    req.once('error', reject);
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(300);
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => socket.end('P1 test-owned listener\n'));
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function closeListener(listener) {
  return new Promise((resolve, reject) =>
    listener.server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function ports() {
  const api = await reservePort();
  const web = await reservePort();
  const result = { API_PORT: String(api.port), WEB_PORT: String(web.port), HOST: '127.0.0.1' };
  await closeListener(api);
  await closeListener(web);
  return result;
}

async function assertClosed(values) {
  await waitFor(
    async () =>
      !(await portOpen(Number(values.API_PORT))) && !(await portOpen(Number(values.WEB_PORT))),
    6000,
    'An owned API/web server remained after shutdown',
  );
}

async function waitHealth(handle, port, name) {
  let health;
  await waitFor(
    async () => {
      if (handle.error || handle.outcome)
        throw new Error(`Server exited before readiness\n${handle.error || ''}\n${handle.log}`);
      try {
        const result = await request(`http://127.0.0.1:${port}/api/health`);
        if (result.status !== 200) return false;
        health = JSON.parse(result.body);
        return health.ready === true;
      } catch {
        return false;
      }
    },
    30000,
    `API never became ready\n${handle.log}`,
  );
  assert(
    health.name === name && health.version === '0.1.0',
    'Health endpoint reports the wrong project/version',
  );
}

async function webDevelopment(runner, project, name, options = {}) {
  const selected = await ports();
  const env = { ...CHILD_ENV, ...selected, ...options.env };
  const handle = launchPackage(runner, project, 'dev', env);
  try {
    await waitHealth(handle, selected.API_PORT, name);
    await waitHealth(handle, selected.WEB_PORT, name);
    const page = await request(`http://127.0.0.1:${selected.WEB_PORT}/`);
    assert(
      page.status === 200 && page.body.includes(name) && /id=["']root["']/.test(page.body),
      'Vite did not serve the configured application',
    );
    const entry = await request(`http://127.0.0.1:${selected.WEB_PORT}/src/main.tsx`);
    assert(
      entry.status === 200 && entry.body.length > 0,
      'Development application entry is unavailable',
    );
  } finally {
    await stop(handle);
    await assertClosed(selected);
  }
}

async function builtWeb(runner, project, name) {
  const selected = await ports();
  const handle = launchPackage(runner, project, 'start', { ...CHILD_ENV, ...selected });
  try {
    await waitHealth(handle, selected.API_PORT, name);
    const url = `http://127.0.0.1:${selected.API_PORT}/`;
    const page = await request(url);
    assert(
      page.status === 200 && page.body.includes(name),
      'Built server did not serve its web build',
    );
    const asset = page.body.match(/<script[^>]+src=["']([^"']+)["']/)?.[1];
    assert(asset, 'Production HTML has no bundled entry');
    const result = await request(new URL(asset, url).href);
    assert(
      result.status === 200 && result.body.length > 0,
      'Production bundled entry is unavailable',
    );
  } finally {
    await stop(handle);
    await assertClosed(selected);
  }
}

async function occupiedPort(runner, project, which) {
  const listener = await reservePort();
  const selected = await ports();
  selected[which] = String(listener.port);
  const handle = launchPackage(runner, project, 'dev', { ...CHILD_ENV, ...selected });
  try {
    await waitFor(
      () => Boolean(handle.outcome || handle.error),
      20000,
      `Occupied ${which} did not terminate startup\n${handle.log}`,
    );
    assert(
      !handle.error && handle.outcome.code !== 0,
      'Occupied-port startup unexpectedly succeeded',
    );
    assert(
      /occupied|in use|EADDRINUSE/i.test(handle.log),
      `Startup omitted actionable port diagnostic\n${handle.log}`,
    );
    assert(
      listener.server.listening && (await portOpen(listener.port)),
      'Startup killed an existing port owner',
    );
    const sibling = Number(selected[which === 'API_PORT' ? 'WEB_PORT' : 'API_PORT']);
    assert(!(await portOpen(sibling)), 'Failed startup left its sibling listening');
  } finally {
    await stop(handle);
    await closeListener(listener);
    await assertClosed(selected);
  }
}

async function apiChildFailure(runner, project) {
  const selected = await ports();
  const fault = path.join(TEMP, 'intentional-api-failure.cjs');
  fs.writeFileSync(
    fault,
    `
if (process.argv[1]?.replace(/\\\\/g, '/').endsWith('/apps/server/src/index.ts')) {
 const net = require('node:net');
 const probe = () => {
  const socket = net.connect({host:'127.0.0.1',port:Number(process.env.WEB_PORT)});
  socket.once('connect', () => { socket.destroy(); setTimeout(() => { console.error('[P1 fault] API child exit'); process.exit(47); }, 500); });
  socket.once('error', () => { socket.destroy(); setTimeout(probe, 50); });
 };
 setTimeout(probe, 50);
}
`,
  );
  const handle = launchPackage(runner, project, 'dev', {
    ...CHILD_ENV,
    ...selected,
    NODE_OPTIONS: `${CHILD_ENV.NODE_OPTIONS || ''} --require ${JSON.stringify(fault)}`.trim(),
  });
  try {
    await waitFor(
      async () => {
        try {
          return (await request(`http://127.0.0.1:${selected.WEB_PORT}/`)).status === 200;
        } catch {
          return false;
        }
      },
      30000,
      `Web sibling never started before fault injection\n${handle.log}`,
    );
    await waitFor(
      () => Boolean(handle.outcome || handle.error),
      20000,
      `API failure did not terminate its supervisor\n${handle.log}`,
    );
    assert(
      !handle.error &&
        handle.outcome.code !== 0 &&
        handle.log.includes('[P1 fault] API child exit'),
      `Did not observe the intended API child failure\n${handle.log}`,
    );
    await assertClosed(selected);
  } finally {
    await stop(handle);
    await assertClosed(selected);
  }
}

function appBundles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (!entry.isDirectory()) return [];
    return entry.name.endsWith('.app') ? [file] : appBundles(file);
  });
}

async function fullChecks() {
  console.log('\nP1 recipes — packed CLI and real project checks');
  let fullRoot;
  if (process.env.KIT_P1_TEST_KEEP_DIR) {
    fs.mkdirSync(path.resolve(process.env.KIT_P1_TEST_KEEP_DIR), { recursive: true });
    fullRoot = fs.mkdtempSync(
      path.join(fs.realpathSync(path.resolve(process.env.KIT_P1_TEST_KEEP_DIR)), 'kit-p1-full-'),
    );
  } else fullRoot = fs.mkdtempSync(path.join(TEMP, 'full-'));
  const projects = [];
  let source;
  const packed = await check(
    'npm package contains all P1 recipes and the self-contained engine',
    () => {
      succeeded(
        run(
          npmExecutable(),
          ['pack', '--silent', '--ignore-scripts', '--pack-destination', fullRoot],
          { timeout: 120000 },
        ),
        'Packing failed',
      );
      const archives = fs.readdirSync(fullRoot).filter((file) => file.endsWith('.tgz'));
      assert(archives.length === 1, 'Expected one npm archive');
      const launcher = path.join(fullRoot, 'launcher');
      writeJson(path.join(launcher, 'package.json'), { name: 'p1-packed-launcher', private: true });
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
          { cwd: launcher, timeout: 120000 },
        ),
        'Packed CLI installation failed',
      );
      const manifest = readJson(path.join(ROOT, 'package.json'));
      source = path.join(launcher, 'node_modules', ...manifest.name.split('/'));
      assert(
        fs.existsSync(path.join(source, 'lib/project-plan.js')),
        'Packed CLI engine is missing',
      );
      for (const recipe of RECIPES) {
        const preset = readJson(path.join(source, 'presets', `${recipe}.json`));
        assert(
          fs.existsSync(path.join(source, preset.create.template, 'package.json.snippet')),
          `Packed ${recipe} template is missing`,
        );
      }
    },
  );
  if (!packed) return;
  for (const recipe of ['node-ts', 'web-api']) {
    const name = `kit-p1-${recipe}`;
    const target = path.join(fullRoot, name);
    const runtime = runtimeFor(source, recipe);
    const runner = packageRunner(runtime);
    projects.push({ recipe, name, target });
    const created = await check(`packed CLI installs and verifies ${recipe}`, () => {
      const f = { source, base: fullRoot, env: CHILD_ENV };
      succeeded(runKit(f, ['create', recipe, target], { timeout: 600000 }), 'Real creation failed');
      assertManifest(target, recipe, name, runtime);
      assert(fs.existsSync(path.join(target, 'pnpm-lock.yaml')), 'Installation omitted lockfile');
    });
    if (!created) continue;
    await check(`${recipe} frozen install and verify preserve source and lockfile`, () => {
      const before = snapshot(target);
      succeeded(
        runPackage(runner, target, ['install', '--frozen-lockfile']),
        'Frozen installation failed',
      );
      succeeded(runPackage(runner, target, ['run', 'verify']), 'CI-equivalent verification failed');
      assert(
        snapshot(target) === before,
        'Frozen installation or verification rewrote source/configuration/lockfile',
      );
    });
    if (recipe === 'node-ts') {
      await check('node-ts starts compiled code and emits only production source', () => {
        const result = runPackage(runner, target, ['run', 'start']);
        succeeded(result, 'Compiled Node entry failed');
        assert(
          output(result).includes(`${name} is ready.`),
          'Compiled entry reports wrong project identity',
        );
        const files = walk(path.join(target, 'dist')).map((file) =>
          path.relative(path.join(target, 'dist'), file),
        );
        assert(
          files.includes('index.js') && files.includes('greeting.js'),
          'Production entries are missing',
        );
        assert(
          files.every((file) => !/test|vitest|tsconfig/.test(file)),
          'Production build contains test/tool output',
        );
      });
      await check('node-ts development watcher runs the source entry', async () => {
        const handle = launchPackage(runner, target, 'dev');
        try {
          await waitFor(
            () => {
              if (handle.error || handle.outcome)
                throw new Error(`Development watcher exited\n${handle.log}`);
              return handle.log.includes(`${name} is ready.`);
            },
            30000,
            `Source entry did not run\n${handle.log}`,
          );
        } finally {
          await stop(handle);
        }
      });
    } else {
      await check(
        'web-api dev serves the app and proxies the real API, then closes both ports',
        () => webDevelopment(runner, target, name),
      );
      await check('web-api built start serves assets and the API on the same origin', () =>
        builtWeb(runner, target, name),
      );
      await check('web-api shell ports take precedence over its actual .env loader', async () => {
        const envFile = path.join(target, '.env');
        const original = fs.existsSync(envFile) ? fs.readFileSync(envFile) : null;
        const before = snapshot(target);
        try {
          fs.copyFileSync(path.join(target, '.env.example'), envFile);
          await webDevelopment(runner, target, name);
        } finally {
          if (original) fs.writeFileSync(envFile, original);
          else fs.rmSync(envFile, { force: true });
        }
        assert(snapshot(target) === before, 'Env precedence test did not restore source baseline');
      });
      for (const which of ['WEB_PORT', 'API_PORT'])
        await check(`web-api rejects occupied ${which} without stopping its owner`, () =>
          occupiedPort(runner, target, which),
        );
      await check(
        'an API child failure stops the running web sibling and fails the supervisor',
        () => apiChildFailure(runner, target),
      );
    }
  }
  if (DESKTOP) {
    const runtime = runtimeFor(source, 'desktop-react');
    const selected = run(NODE, [
      '-p',
      'JSON.stringify({platform:process.platform,architecture:process.arch,nodeVersion:process.versions.node})',
    ]);
    succeeded(selected, 'Cannot inspect native host');
    const compatibility = require('../lib/project-plan').runtimeCompatibility(
      runtime,
      JSON.parse(selected.stdout),
    );
    if (
      !compatibility.ok ||
      !(runtime.commands || []).every((command) => commandAvailable(command))
    )
      skip(
        `Native build unavailable: ${compatibility.ok ? 'required executable is missing' : compatibility.message}`,
      );
    else {
      const target = path.join(fullRoot, 'kit-p1-desktop');
      const runner = packageRunner(runtime);
      projects.push({ recipe: 'desktop-react', name: 'kit-p1-desktop', target });
      const created = await check(
        'desktop-react creates a verified unsigned native artifact',
        () => {
          succeeded(
            runKit(
              { source, base: fullRoot, env: CHILD_ENV },
              ['create', 'desktop-react', target],
              { timeout: 900000 },
            ),
            'Native project creation failed',
          );
          assertManifest(target, 'desktop-react', 'kit-p1-desktop', runtime);
          succeeded(
            runPackage(runner, target, ['run', 'desktop:prepare'], { timeout: 600000 }),
            'Native preparation failed',
          );
          succeeded(
            runPackage(runner, target, ['run', 'desktop:build'], { timeout: 900000 }),
            'Unsigned native build failed',
          );
          const bundles = appBundles(path.join(target, '.cache/electrobun/build'));
          assert(
            bundles.some((bundle) => fs.existsSync(path.join(bundle, 'Contents/Info.plist'))),
            'Native build emitted no usable app bundle',
          );
          assert(
            !walk(path.join(target, '.cache/electrobun/artifacts')).some((file) =>
              file.endsWith('.dmg'),
            ),
            'Unsigned development build unexpectedly emitted a distribution DMG',
          );
          console.log(`    Native bundles: ${bundles.join(', ')}`);
        },
      );
      if (created && DESKTOP_RUN)
        await check(
          'native development process remains running during a bounded launch smoke',
          async () => {
            const handle = launchPackage(runner, target, 'preview');
            try {
              await delay(8000);
              assert(
                !handle.error && !handle.outcome,
                `Native process stopped during launch\n${handle.log}`,
              );
              console.log(
                '    Process startup observed; actual app UI requires separate acceptance.',
              );
            } finally {
              await stop(handle);
            }
          },
        );
    }
  }
  if (process.env.KIT_P1_TEST_KEEP_DIR) {
    writeJson(path.join(fullRoot, 'projects.json'), projects);
    console.log(`\nP1 projects retained: ${fullRoot}`);
    for (const project of projects) console.log(`  ${project.recipe}: ${project.target}`);
  }
}

(async () => {
  try {
    const unknown = process.argv
      .slice(2)
      .filter((flag) => !['--full', '--desktop', '--desktop-run'].includes(flag));
    assert(!unknown.length, `Unknown test option: ${unknown.join(', ')}`);
    assert(!DESKTOP_RUN || (FULL && DESKTOP), '--desktop-run requires --full --desktop');
    assert(!DESKTOP || FULL, '--desktop requires --full');
    await fastChecks();
    if (FULL) await fullChecks();
  } catch (error) {
    failures.push({ name: 'P1 test harness', message: error.stack || error.message });
  } finally {
    for (const handle of [...PROCESSES]) await stop(handle);
    fs.rmSync(TEMP, { recursive: true, force: true });
  }
  console.log(
    `\nP1 tests: ${passed} passed, ${failures.length} failed, ${skipped} skipped${FULL ? '' : ' (offline tier)'}`,
  );
  for (const failure of failures) console.error(`\n${failure.name}\n${failure.message}`);
  process.exitCode = failures.length ? 1 : 0;
})();
