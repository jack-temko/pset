/// <reference types="vitest/config" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Dev-only: forward API calls to the Go server (`pset`).
      // PSET_API_TARGET repoints it, e.g. at an acceptance server on :8421.
      '/api': process.env.PSET_API_TARGET ?? 'http://127.0.0.1:8420',
    },
  },
  test: {
    environment: 'jsdom',
    // The suite runs on every core at once under `make check`, and a jsdom
    // render of a whole screen then takes several times its solo time (the
    // workspace tests: 0.5 s alone, seconds under load). The tests use fake
    // time and wait on nothing; the default 5 s only measures a busy machine.
    testTimeout: 30_000,
    // tokens.test.ts reads tokens.css as text, so vitest must not process it.
    css: { include: [/tokens\.css/] },
  },
});
