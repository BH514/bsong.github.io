import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/pages',
  fullyParallel: false,
  workers: 1,
})
