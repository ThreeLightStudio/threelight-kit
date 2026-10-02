import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readRuntimeConfig } from './runtime-config.mjs';

const children = new Set();
let stopping = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function signalChild(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH')
      console.error(`[dev] Could not stop an owned process: ${error.message}`);
  }
}

async function stopAll(code, message) {
  if (stopping) return;
  stopping = true;
  if (message) console.error(`[dev] ${message}`);

  const exits = [...children].map((child) => {
    if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
    return new Promise((resolve) => child.once('exit', resolve));
  });
  for (const child of children) signalChild(child, 'SIGTERM');
  await Promise.race([Promise.all(exits), delay(1500)]);
  // The immediate child can exit while its descendants remain in the owned group.
  for (const child of children) signalChild(child, 'SIGKILL');
  process.exit(code);
}

// Package runners may forward a signal already delivered to this process group.
// Keep handlers installed through asynchronous cleanup; stopAll ignores repeats.
process.on('SIGINT', () => void stopAll(0));
process.on('SIGTERM', () => void stopAll(0));

function startChild(label, args, runtime) {
  const child = spawn(process.execPath, args, {
    cwd: runtime.root,
    env: process.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  children.add(child);
  child.once('error', (error) => void stopAll(1, `${label} could not start: ${error.message}`));
  child.once('exit', (code, signal) => {
    if (!stopping) void stopAll(1, `${label} stopped unexpectedly (${signal ?? `exit ${code}`}).`);
  });
  return child;
}

function assertPortAvailable(host, port, label) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => {
      reject(
        new Error(
          `${label} port ${port} is unavailable (${error.code}). Stop its owner or choose another port; no existing process was stopped.`,
        ),
      );
    });
    probe.listen(port, host, () => probe.close((error) => (error ? reject(error) : resolve())));
  });
}

async function waitForApi(runtime) {
  const health = `${runtime.apiOrigin}/api/health`;
  const deadline = Date.now() + 15000;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(health, { signal: AbortSignal.timeout(500) });
      const body = await response.json();
      if (
        response.ok &&
        body.ready === true &&
        body.name === runtime.name &&
        body.version === runtime.version
      )
        return;
    } catch {}
    await delay(100);
  }
  if (stopping) throw new Error('Startup was cancelled.');
  throw new Error(`API was not ready at ${health} within 15 seconds. Check the API output above.`);
}

async function main() {
  const runtime = readRuntimeConfig();
  await assertPortAvailable(runtime.host, runtime.apiPort, 'API');
  await assertPortAvailable(runtime.host, runtime.webPort, 'Web');
  if (stopping) return;

  startChild('API', ['--import', 'tsx', 'apps/server/src/index.ts', '--dev'], runtime);
  await waitForApi(runtime);
  if (stopping) return;

  startChild(
    'Web',
    [
      path.join(runtime.root, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--config',
      'vite.config.ts',
    ],
    runtime,
  );
  console.log(`[dev] Web: ${runtime.webOrigin}`);
  console.log(`[dev] API ready: ${runtime.apiOrigin}/api/health`);
  console.log('[dev] Press Ctrl+C to stop both owned servers.');
}

main().catch((error) => void stopAll(1, error.message));
