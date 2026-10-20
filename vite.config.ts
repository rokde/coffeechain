/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Tauri loads devUrl port 5173: fail fast when it is busy, never show another dev server.
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts', 'config/**/*.test.ts'],
  },
})
