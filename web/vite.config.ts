/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

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
      // Dev-only: forward API calls to the Go server (`pset serve`).
      // PSET_API_TARGET repoints it, e.g. at an acceptance server on :8421.
      '/api': process.env.PSET_API_TARGET ?? 'http://127.0.0.1:8420',
    },
  },
  test: {
    environment: 'jsdom',
  },
})
