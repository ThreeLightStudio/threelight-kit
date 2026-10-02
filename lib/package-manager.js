const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function checkRuntimeCommands(runtime) {
  const directories = (process.env.PATH ?? '').split(path.delimiter);
  for (const command of runtime.commands ?? []) {
    const available = directories.some((directory) => {
      try {
        const executable = path.join(directory, command);
        if (!fs.statSync(executable).isFile()) return false;
        fs.accessSync(executable, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
    if (!available)
      throw new Error(
        `Missing prerequisite: ${command}. Install this command before creating the preset; see its prerequisites in the README.`,
      );
  }
}

function runtimeNodeEnvironment(cwd) {
  const probe = spawnSync('node', ['--version'], { cwd, encoding: 'utf8', timeout: 10000 });
  if (!probe.error && probe.status === 0 && probe.stdout.trim() === process.version)
    return process.env;
  // Explicitly invoking this CLI with Node 24 must also run its children with it.
  return {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}`,
  };
}

function selectPackageManager(runtime, cwd) {
  const env = runtimeNodeEnvironment(cwd);
  const probe = spawnSync('pnpm', ['--version'], { cwd, env, encoding: 'utf8', timeout: 10000 });
  if (!probe.error && probe.status === 0 && probe.stdout.trim() === runtime.pnpm)
    return { command: 'pnpm', prefix: [], env };
  // npm exec adds the pinned pnpm bin directory to PATH for nested package scripts.
  return {
    command: 'npm',
    prefix: ['exec', '--yes', `--package=pnpm@${runtime.pnpm}`, '--', 'pnpm'],
    env,
  };
}

function runPackageCommand(manager, args, cwd) {
  const argv = [...manager.prefix, ...args];
  console.log(`$ ${manager.command} ${argv.join(' ')}`);
  const result = spawnSync(manager.command, argv, {
    cwd,
    env: manager.env ?? process.env,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Command failed: ${manager.command} ${argv.join(' ')}${result.error ? ` (${result.error.message})` : ''}`,
    );
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function recoveryCommands(destination, runtime) {
  const prefix = `npm exec --yes --package=pnpm@${runtime.pnpm} -- pnpm`;
  return [
    `cd ${shellQuote(destination)}`,
    `${prefix} install --no-frozen-lockfile`,
    `${prefix} run format`,
    `${prefix} run verify`,
  ];
}

module.exports = {
  runtimeNodeEnvironment,
  selectPackageManager,
  runPackageCommand,
  recoveryCommands,
  checkRuntimeCommands,
};
