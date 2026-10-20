import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  projects: [
    { name: 'screenshot', testIgnore: 'thirty-day-run.spec.ts' },
    { name: 'run30', testMatch: 'thirty-day-run.spec.ts' },
  ],
  use: { baseURL: 'http://localhost:5199', viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
  },
})
