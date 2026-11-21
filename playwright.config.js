// @ts-check
import { defineConfig, devices } from "@playwright/test"

// Credentials for the real-backend projects (setup / int) come from .env or .env.local:
// E2E_SUPERADMIN_USERNAME, E2E_SUPERADMIN_PASSWORD. Loaded here only; never printed, never in code.
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file)
  } catch {
    // file missing: the real-backend tests skip themselves
  }
}

const PORT = 4173 // not 5173: the dev server (and another local app) use it
const BASE_URL = `http://127.0.0.1:${PORT}`
const browser = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
  baseURL: BASE_URL,
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
  contextOptions: { reducedMotion: /** @type {const} */ ("reduce") },
}
export const SUPERADMIN_STATE = ".auth/superadmin.json"
// Company accounts (E2E_COMPANY_ADMIN_*, E2E_MANAGER_*, E2E_HR_*, E2E_EMPLOYEE_*), one session each, made by e2e/company.setup.js.
export const COMPANY_STATES = {
  companyAdmin: ".auth/company-admin.json",
  manager: ".auth/manager.json",
  hr: ".auth/hr.json",
  employee: ".auth/employee.json",
}

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
      // UI with every /api call mocked (no backend needed).
      name: "ui",
      testIgnore: [/\.api\.spec\.js$/, /\.int\.spec\.js$/, /\.setup\.js$/],
      use: browser,
    },
    {
      // Contract tests against the running ERP gateway (backend must be up).
      name: "api",
      testMatch: /\.api\.spec\.js$/,
      use: { baseURL: process.env.E2E_API_URL ?? "http://localhost:18080/api/v1/" },
    },
    {
      // One real Super Admin login through the UI for the whole run (repeated logins trip AUTH_008 lockout).
      name: "setup",
      testMatch: /\.setup\.js$/,
      use: browser,
    },
    {
      // UI against the real backend (through next start's /api proxy), logged in as Super Admin. Read-only checks.
      name: "int",
      testMatch: /\.int\.spec\.js$/,
      dependencies: ["setup"],
      fullyParallel: false,
      use: { ...browser, storageState: SUPERADMIN_STATE },
    },
  ],
  // UI tests run against a fresh production build.
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
