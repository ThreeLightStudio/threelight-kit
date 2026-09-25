import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Adjust to match project layout. Vite config for the web build going into the desktop shell.
const viteConfig = 'apps/web/vite.config.ts';

const output = resolve(
  process.cwd(),
  process.env.DESKTOP_ENV === 'stable'
    ? '.cache/electrobun/web'
    : '.cache/electrobun/dev/web',
);
const result = spawnSync(
  'pnpm',
  ['exec', 'vite', 'build', '--config', viteConfig, '--outDir', output],
  { stdio: 'inherit' },
);

if (result.error) throw result.error;
if (result.status !== 0)
  throw new Error(`Web build failed with exit code ${result.status}`);