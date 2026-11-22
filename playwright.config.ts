import { defineConfig } from '@playwright/test'

/**
 * End-to-end checks on the production build, at phone width (375 px) first.
 *   npm run e2e
 * The service worker is blocked so that every run starts from what the build serves.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:4173/suivapp-rpg/',
    serviceWorkers: 'block',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } }, grepInvert: /@phone-only/ },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/suivapp-rpg/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
