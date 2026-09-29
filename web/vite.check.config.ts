import path from 'node:path'
import { defineConfig } from 'vite'

// Bundles src/lib/katex-check.ts into one IIFE for the Go server to embed
// (internal/doc/katex-check.js). Run with `npm run build:check`.
export default defineConfig({
  build: {
    target: 'es2019',
    minify: true,
    emptyOutDir: false,
    copyPublicDir: false,
    outDir: path.resolve(__dirname, '../internal/doc'),
    lib: {
      entry: path.resolve(__dirname, 'src/lib/katex-check.ts'),
      formats: ['iife'],
      name: 'PSetKatexCheck',
      fileName: () => 'katex-check.js',
    },
  },
})
