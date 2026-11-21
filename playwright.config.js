// @ts-check
import { defineConfig, devices } from "@playwright/test"

const PORT = 4173 // not 5173: the dev server (and another local app) use it

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries hide flakiness; a retried pass is still reported as "flaky".
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "ui",
      testIgnore: /\.api\.spec\.js$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        baseURL: `http://127.0.0.1:${PORT}`,
        locale: "vi-VN",
        timezoneId: "Asia/Ho_Chi_Minh",
        contextOptions: { reducedMotion: "reduce" },
      },
    },
    {
      // Contract tests against the running ERP gateway (backend must be up).
      name: "api",
      testMatch: /\.api\.spec\.js$/,
      use: { baseURL: process.env.E2E_API_URL ?? "http://localhost:18080/api/v1/" },
    },
  ],
  // UI tests run against a fresh production build; /api is mocked per test.
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
