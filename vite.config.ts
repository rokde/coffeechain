/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    // Installable PWA (Android, iOS, desktop browsers); the service worker caches the build for offline play.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'CoffeeChain',
        short_name: 'CoffeeChain',
        lang: 'de',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,glb,gltf,json,woff2}'] },
    }),
  ],
  // GitHub Pages serves project sites from a /<repo-name>/ subpath (set by deploy.yml); Tauri and dev use '/'.
  base: process.env.BASE_PATH ? `${process.env.BASE_PATH.replace(/\/$/, '')}/` : '/',
  // Tauri loads devUrl port 5173: fail fast when it is busy, never show another dev server.
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts', 'config/**/*.test.ts', 'tools/**/*.test.ts'],
  },
})
