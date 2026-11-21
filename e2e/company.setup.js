// @ts-check
/**
 * Logs in once per real company account and saves each session for the `int` project:
 * E2E_COMPANY_ADMIN_*, E2E_MANAGER_*, E2E_HR_*, E2E_EMPLOYEE_* (USERNAME / PASSWORD) from .env or .env.local, never printed.
 * An account that is not set is skipped. Spec: POST /api/v1/auth/login → TokenDto; GET /api/v1/me.
 */
import { expect, test as setup } from "@playwright/test"

import { COMPANY_STATES } from "../playwright.config.js"

const ACCOUNTS = /** @type {const} */ ([
  ["companyAdmin", "E2E_COMPANY_ADMIN"],
  ["manager", "E2E_MANAGER"],
  ["hr", "E2E_HR"],
  ["employee", "E2E_EMPLOYEE"],
])

for (const [role, prefix] of ACCOUNTS) {
  setup(`đăng nhập thật bằng tài khoản ${role}`, async ({ page }) => {
    const username = process.env[`${prefix}_USERNAME`]
    const password = process.env[`${prefix}_PASSWORD`]
    setup.skip(!username || !password, `${prefix}_USERNAME / ${prefix}_PASSWORD not set`)

    await page.goto("/login")
    await page.getByLabel("Email").fill(/** @type {string} */ (username))
    await page.getByLabel("Mật khẩu", { exact: true }).fill(/** @type {string} */ (password))
    const me = page.waitForResponse((r) => r.url().endsWith("/api/v1/me") && r.request().method() === "GET")
    await page.getByRole("button", { name: "Đăng nhập" }).click()

    // A failed real login stops here (no retry: the account locks after repeated failures).
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 })
    const body = await (await me).json()
    expect(body?.data?.superAdmin, `${prefix} must be a company account`).toBe(false)
    await page.context().storageState({ path: COMPANY_STATES[role] })
  })
}
