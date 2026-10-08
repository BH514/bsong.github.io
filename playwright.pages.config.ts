import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pages',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174/branching-futures/',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4174 --strictPort --base /branching-futures/',
    url: 'http://127.0.0.1:4174/branching-futures/',
    reuseExistingServer: false,
  },
});
