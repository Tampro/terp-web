// @ts-check
/**
 * Logs in once as the real Super Admin and saves the session (localStorage tokens) for the `int` project.
 * Credentials: E2E_SUPERADMIN_USERNAME / E2E_SUPERADMIN_PASSWORD from .env or .env.local (never printed).
 * Spec: POST /api/v1/auth/login → TokenDto; GET /api/v1/me → superAdmin true.
 */
import { expect, test as setup } from "@playwright/test"

import { SUPERADMIN_STATE } from "../playwright.config.js"

setup("đăng nhập thật bằng Super Admin", async ({ page }) => {
  const username = process.env.E2E_SUPERADMIN_USERNAME
  const password = process.env.E2E_SUPERADMIN_PASSWORD
  setup.skip(!username || !password, "E2E_SUPERADMIN_USERNAME / E2E_SUPERADMIN_PASSWORD not set in .env")

  await page.goto("/login")
  await page.getByLabel("Email").fill(/** @type {string} */ (username))
  await page.getByLabel("Mật khẩu", { exact: true }).fill(/** @type {string} */ (password))
  const me = page.waitForResponse((r) => r.url().endsWith("/api/v1/me") && r.request().method() === "GET")
  await page.getByRole("button", { name: "Đăng nhập" }).click()

  // A failed real login stops here (no retry: the account locks after repeated failures).
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 })
  const body = await (await me).json()
  expect(body?.data?.superAdmin, "the account in .env must be the platform Super Admin").toBe(true)
  await page.context().storageState({ path: SUPERADMIN_STATE })
})
