import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  reporter: 'list',
  webServer: {
    command: 'npm run build:assistant-sdk && ./node_modules/.bin/vite --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/tests/fixtures/assistant-sdk/mobile-rwd-host.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    headless: true
  }
})
