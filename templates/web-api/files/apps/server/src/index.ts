import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { readRuntimeConfig } from '../../../scripts/runtime-config.mjs';
import { createApp } from './app.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--dev')) {
    throw new Error('Unknown server option. Use pnpm dev or pnpm build followed by pnpm start.');
  }
  const development = args[0] === '--dev';
  const runtime = readRuntimeConfig();
  if (!development && !existsSync(path.join(runtime.webDist, 'index.html'))) {
    throw new Error('Web build is missing. Run pnpm build before pnpm start.');
  }
  await mkdir(runtime.dataDir, { recursive: true });
  const server = createApp({
    name: runtime.name,
    version: runtime.version,
    webRoot: development ? undefined : runtime.webDist,
  });

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => {
      server.closeAllConnections();
      process.exit(0);
    }, 1000);
    timeout.unref();
    server.close((error) => {
      clearTimeout(timeout);
      process.exit(error ? 1 : 0);
    });
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(runtime.apiPort, runtime.host, () => resolve());
  }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      throw new Error(
        `API port ${runtime.apiPort} is occupied. Stop its owner or choose another API_PORT; no existing process was stopped.`,
      );
    }
    throw error;
  });

  console.log(`[api] Ready: ${runtime.apiOrigin}/api/health`);
  if (!development) console.log(`[app] Web and API: ${runtime.apiOrigin}`);
}

main().catch((error) => {
  console.error(`[api] Startup failed: ${error.message}`);
  process.exitCode = 1;
});
