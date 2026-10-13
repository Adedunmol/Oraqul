import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Set PW_CHANNEL=chrome to use installed Chrome where Playwright has no bundled Chromium (e.g. macOS 13).
  use: { baseURL: 'http://localhost:3000', channel: process.env.PW_CHANNEL },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
