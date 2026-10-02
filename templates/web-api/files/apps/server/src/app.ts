import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { HealthResponse } from '@app/contracts';

export interface AppOptions {
  name: string;
  version: string;
  webRoot?: string;
}

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  type: string,
  body: string | Buffer,
) {
  response.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function json(request: IncomingMessage, response: ServerResponse, status: number, body: unknown) {
  send(request, response, status, 'application/json; charset=utf-8', JSON.stringify(body));
}

async function isFile(file: string) {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
    throw error;
  }
}

async function handle(request: IncomingMessage, response: ServerResponse, options: AppOptions) {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    if (pathname.includes('\0')) throw new Error('Invalid path');
  } catch {
    json(request, response, 400, { error: 'Invalid request path' });
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    json(request, response, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/health') {
    const health: HealthResponse = { ready: true, name: options.name, version: options.version };
    response.setHeader('Cache-Control', 'no-store');
    json(request, response, 200, health);
    return;
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    json(request, response, 404, { error: 'API route not found' });
    return;
  }

  if (!options.webRoot) {
    json(request, response, 404, { error: 'Use the Vite web address during development.' });
    return;
  }

  const root = path.resolve(options.webRoot);
  let file = path.resolve(root, `.${pathname}`);
  const relative = path.relative(root, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    json(request, response, 403, { error: 'Path is outside the web build' });
    return;
  }

  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (!(await isFile(file))) {
    if (path.extname(pathname)) {
      json(request, response, 404, { error: 'Web asset not found' });
      return;
    }
    file = path.join(root, 'index.html');
  }
  if (!(await isFile(file))) {
    send(
      request,
      response,
      404,
      'text/plain; charset=utf-8',
      'Web build is missing. Run pnpm build before pnpm start.',
    );
    return;
  }

  response.setHeader('Cache-Control', 'no-cache');
  send(
    request,
    response,
    200,
    contentTypes[path.extname(file)] ?? 'application/octet-stream',
    await readFile(file),
  );
}

export function createApp(options: AppOptions) {
  return createServer((request, response) => {
    void handle(request, response, options).catch((error) => {
      console.error(`[api] Request failed: ${error.message}`);
      if (!response.headersSent) json(request, response, 500, { error: 'Internal server error' });
      else response.destroy();
    });
  });
}
