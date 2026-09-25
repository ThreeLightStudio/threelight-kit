// root and alias are based on import.meta.dirname, so the location where this file sits becomes the app's reference point.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
});