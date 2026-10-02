import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfig from './tsconfig.json';

const alias = Object.fromEntries(
  Object.entries(tsconfig.compilerOptions.paths).map(([name, paths]) => [
    name.replace(/\/\*$/, ''),
    fileURLToPath(new URL(paths[0].replace(/\/\*$/, ''), import.meta.url)),
  ]),
);

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
