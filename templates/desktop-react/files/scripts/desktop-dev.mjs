import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const command = process.argv[2] ?? 'dev';
if (!['dev', 'run'].includes(command) || process.argv.length > 3) {
  throw new Error('Usage: node scripts/desktop-dev.mjs [dev|run]');
}

const args = [resolve('node_modules/electrobun/bin/electrobun.cjs'), command, '--env=dev'];
if (command === 'dev') args.push('--watch');

// Keep this Node launcher separate from the native Hutch/Cottontail app
// process, and forward termination to this launcher's entire child group.
const child = spawn(process.execPath, args, {
  detached: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    DESKTOP_ENV: 'dev',
    ...(process.stderr.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb'
      ? { FORCE_COLOR: process.env.FORCE_COLOR ?? '1' }
      : {}),
  },
});

let intentionalStop = false;
let cleanupPromise;
function signalGroup(signal) {
  if (!child.pid) return false;
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    return false;
  }
}

function cleanup(signal, exitCode) {
  if (cleanupPromise) return cleanupPromise;
  process.exitCode = exitCode;
  cleanupPromise = (async () => {
    signalGroup(signal);
    const deadline = Date.now() + 2000;
    // Keep the grace timers referenced: the CLI may exit before its native
    // descendants, but those processes still belong to this launcher's group.
    while (signalGroup(0) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(50, deadline - Date.now())));
    }
    signalGroup('SIGKILL');
  })();
  cleanupPromise.catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  return cleanupPromise;
}

function stop(signal) {
  intentionalStop = true;
  void cleanup(signal, 0);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
child.on('error', (error) => {
  console.error(error);
  void cleanup('SIGTERM', 1);
});
child.on('exit', (code) => {
  void cleanup('SIGTERM', intentionalStop ? 0 : (code ?? 1));
});
