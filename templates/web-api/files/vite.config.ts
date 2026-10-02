import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfig from './tsconfig.json';
import { readRuntimeConfig } from './scripts/runtime-config.mjs';

const runtime = readRuntimeConfig();
const alias = Object.fromEntries(
  Object.entries(tsconfig.compilerOptions.paths).map(([name, paths]) => [
    name.replace(/\/\*$/, ''),
    fileURLToPath(new URL(paths[0].replace(/\/\*$/, ''), import.meta.url)),
  ]),
);

export default defineConfig({
  root: fileURLToPath(new URL('./apps/web', import.meta.url)),
  plugins: [react()],
  resolve: { alias },
  server: {
    host: runtime.host,
    port: runtime.webPort,
    strictPort: true,
    proxy: { '/api': { target: runtime.apiOrigin } },
  },
  build: { outDir: runtime.webDist, emptyOutDir: true },
});
