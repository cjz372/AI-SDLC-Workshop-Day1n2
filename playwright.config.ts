import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: 'Asia/Singapore',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /smoke\.spec\.ts/ },
    // Virtual authenticators are Chromium-only, so other browsers/devices run the auth-free smoke checks.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: /smoke\.spec\.ts/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: /smoke\.spec\.ts/ },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, testMatch: /smoke\.spec\.ts/ },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] }, testMatch: /smoke\.spec\.ts/ },
  ],
  webServer: {
    command: `rm -f .e2e-todos.db* && npx tsx scripts/seed-holidays.ts && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DB_PATH: '.e2e-todos.db',
      JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123456789',
      RP_ID: 'localhost',
      RP_NAME: 'Todo App',
      RP_ORIGIN: `http://localhost:${PORT}`,
      AUTH_RATE_LIMIT: '100000',
    },
  },
});
