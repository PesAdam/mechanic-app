import { defineConfig, devices } from '@playwright/test'

/**
 * E2E against the real API: `e2e/api.sh` migrates and seeds a throwaway SQLite
 * (api/.env.e2e, port 8099) and the production build is served by `vite preview`
 * on 5199 with /api proxied there. One worker: the specs share that database.
 */
const API = 'http://127.0.0.1:8099'
const WEB = 'http://127.0.0.1:5199'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: WEB,
    locale: 'sk-SK',
    timezoneId: 'Europe/Bratislava',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'bash e2e/api.sh', url: `${API}/up`, reuseExistingServer: !process.env.CI, timeout: 120_000 },
    { command: 'npm run build && npx vite preview --host 127.0.0.1 --port 5199 --strictPort', url: WEB, reuseExistingServer: !process.env.CI, env: { API_PROXY_TARGET: API }, timeout: 180_000 },
  ],
})
