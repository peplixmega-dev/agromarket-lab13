import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const localBrowsers = fileURLToPath(new URL('./.playwright-browsers', import.meta.url));
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(localBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
}
const envFile = fileURLToPath(new URL('./.env.e2e', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const externalURL = process.env.BASE_URL || process.env.E2E_BASE_URL || process.env.PRODUCTION_URL;
if (externalURL && !['http:', 'https:'].includes(new URL(externalURL).protocol)) {
  throw new Error('BASE_URL должен быть HTTP(S)-адресом сайта');
}
// Эти данные используются исключительно в отдельной локальной базе E2E.
if (!externalURL) {
  process.env.E2E_ADMIN_EMAIL ||= 'e2e-admin@agromarket.test';
  process.env.E2E_ADMIN_PASSWORD ||= randomBytes(24).toString('base64url');
}
export default defineConfig({
  testDir: './e2e',
  // Любой внешний URL ограничивает набор только чтением, даже при `npm run e2e`.
  testMatch: externalURL ? '**/catalog.spec.js' : '**/*.spec.js',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalURL || 'http://127.0.0.1:3100',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalURL ? undefined : {
    command: 'node ../server/scripts/demo.js',
    url: 'http://127.0.0.1:3100/api/health',
    env: {
      DEMO_PORT: '3100', DEMO_DB_PORT: '55440',
      DEMO_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
      DEMO_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
      DEMO_QUIET_CREDENTIALS: '1',
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
