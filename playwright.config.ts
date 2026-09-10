import { defineConfig, devices } from '@playwright/test';
import { UI_BASE_URL } from './utils/env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries mask nothing here: a real failure still fails, retries just
  // absorb one-off infra/network hiccups against a shared public demo site
  // in CI. Locally you want to see a failure the first time.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: UI_BASE_URL,
    // The app identifies elements via `data-test`, not the Playwright
    // default `data-testid` - this makes getByTestId() work against it.
    testIdAttribute: 'data-test',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
