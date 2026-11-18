import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
if (!process.env.E2E_DB_URL) throw new Error('Set E2E_DB_URL to an isolated test database');
process.env.CC_E2E_ADMIN_PASSWORD ||= randomBytes(24).toString('hex');
const browsers = {
  chromium: 'Desktop Chrome',
  firefox: 'Desktop Firefox',
  webkit: 'Desktop Safari',
};
const browser = process.env.E2E_BROWSER || 'chromium';
if (!Object.hasOwn(browsers, browser)) throw new Error('E2E_BROWSER must be chromium, firefox or webkit');

export default defineConfig({
  testDir: './tests/e2e',
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  projects: [{ name: browser, use: devices[browsers[browser]] }],
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['junit', { outputFile: 'reports/frontend/tests/playwright-junit.xml' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: process.platform === 'win32' ? 'gradlew.bat bootRun' : './gradlew bootRun',
      cwd: '../backend',
      env: { MEDIA_CLEANUP_ENABLED: 'false', MAIL_HOST: '127.0.0.1', MAIL_PORT: process.env.E2E_MAIL_PORT || '1025', MAIL_AUTH: 'false', MAIL_STARTTLS: 'false', MAIL_USERNAME: '', MAIL_PASSWORD: '', MAIL_FROM: 'test@e2e.invalid', PUBLIC_APP_URL: 'http://127.0.0.1:5173', MEDIA_ROOT: mkdtempSync(join(tmpdir(), 'culinary-e2e-media-')), DB_URL: process.env.E2E_DB_URL, JWT_SECRET: randomBytes(48).toString('base64'), COOKIE_SECURE: 'false', BOOTSTRAP_ADMIN: 'true', ADMIN_EMAIL: 'admin@e2e.invalid', ADMIN_PASSWORD: process.env.CC_E2E_ADMIN_PASSWORD },
      url: 'http://127.0.0.1:8080/api/health',
      reuseExistingServer: false,
      timeout: 180000,
    },
    {
      command: 'npm run dev',
      cwd: '.',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
