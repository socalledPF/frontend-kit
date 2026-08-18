import { defineConfig, devices } from '@playwright/test'

const localChrome = process.platform === 'darwin' ? { channel: 'chrome' as const } : {}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [
    {
      command:
        'apps/playground-vue2/node_modules/.bin/vite apps/playground-vue2 --host 127.0.0.1 --port 4172',
      url: 'http://127.0.0.1:4172',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command:
        'apps/playground-vue3/node_modules/.bin/vite apps/playground-vue3 --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], ...localChrome, viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], ...localChrome, viewport: { width: 390, height: 844 } }
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }
    }
  ]
})
