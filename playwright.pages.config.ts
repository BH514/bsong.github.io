import { defineConfig } from '@playwright/test'

const BASE = 'http://127.0.0.1:4173/cooking-battle/'

export default defineConfig({
  testDir: './tests/pages',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: BASE },
  /**
   * Playwright polls for readiness and tears the server down with its child,
   * which a spawn plus a fixed sleep cannot promise. A leaked process holding
   * 4173 would silently serve a stale dist/ to every later local run, so
   * reuseExistingServer stays off.
   */
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --base /cooking-battle/',
    url: BASE,
    reuseExistingServer: false,
  },
})
