/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // GitHub Pages serves project sites from a /<repo-name>/ subpath (set by deploy.yml); Tauri and dev use '/'.
  base: process.env.BASE_PATH ? `${process.env.BASE_PATH.replace(/\/$/, '')}/` : '/',
  // Tauri loads devUrl port 5173: fail fast when it is busy, never show another dev server.
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts', 'config/**/*.test.ts', 'tools/**/*.test.ts'],
  },
})
