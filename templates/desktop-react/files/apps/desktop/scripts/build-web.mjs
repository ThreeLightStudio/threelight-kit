import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Hutch executes hooks in Cottontail. Its process.execPath is the native
// runtime, so invoke the project's supported Node explicitly for Vite.
const result = spawnSync(
  'node',
  [
    resolve('node_modules/vite/bin/vite.js'),
    'build',
    '--config',
    'vite.config.ts',
    '--outDir',
    resolve('.cache/electrobun/web'),
  ],
  { stdio: 'inherit' },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Web build failed with exit code ${result.status ?? result.signal ?? 'unknown'}`);
}
