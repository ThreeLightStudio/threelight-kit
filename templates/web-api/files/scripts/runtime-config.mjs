import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function port(value, name, fallback) {
  const raw = value === undefined ? String(fallback) : value.trim();
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535) {
    throw new Error(
      `${name} must be an integer between 1 and 65535; received ${JSON.stringify(value)}.`,
    );
  }
  return Number(raw);
}

export function readRuntimeConfig() {
  const envFile = path.join(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const host = process.env.HOST?.trim() ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    throw new Error('HOST must be 127.0.0.1. This starter binds local servers to loopback only.');
  }

  const webPort = port(process.env.WEB_PORT, 'WEB_PORT', 5173);
  const apiPort = port(process.env.API_PORT, 'API_PORT', 8787);
  if (webPort === apiPort) {
    throw new Error(
      'WEB_PORT and API_PORT must differ. Choose two free local ports in .env or your shell.',
    );
  }

  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  return {
    root,
    host,
    webPort,
    apiPort,
    webOrigin: `http://${host}:${webPort}`,
    apiOrigin: `http://${host}:${apiPort}`,
    webDist: path.join(root, 'dist', 'web'),
    dataDir: path.join(root, '.cache', 'dev'),
    name: manifest.name,
    version: manifest.version,
  };
}
