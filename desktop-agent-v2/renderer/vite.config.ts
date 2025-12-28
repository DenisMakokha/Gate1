import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(path.dirname(fileURLToPath(import.meta.url))),
  base: './',
  build: {
    outDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
