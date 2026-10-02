import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '@server/app';

const server = createApp({ name: 'api-test', version: '0.1.0' });
let origin: string;

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe('the actual HTTP API', () => {
  it('returns the typed ready response over HTTP', async () => {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(2000) });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ ready: true, name: 'api-test', version: '0.1.0' });
  });

  it('keeps unknown API routes separate from web fallback', async () => {
    const response = await fetch(`${origin}/api/missing`, { signal: AbortSignal.timeout(2000) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'API route not found' });
  });

  it('rejects unsupported methods', async () => {
    const response = await fetch(`${origin}/api/health`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });
});
