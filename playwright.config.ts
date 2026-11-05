import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
  },
  // Builds the app and serves it with the same /api/understand handler (real Gemini, key from env).
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `npx vite build && npx vite preview --port ${PORT}`, port: PORT, reuseExistingServer: true, timeout: 120_000 },
});
