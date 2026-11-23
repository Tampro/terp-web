// @ts-check
/** §3.7 cookie settings against the REAL backend, read-only: the form shows GET /v1/settings/admin/cookie. */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { SUPERADMIN_STATE } from "../../playwright.config.js"

test.skip(!fs.existsSync(SUPERADMIN_STATE), "no superadmin session")
test.use({ storageState: SUPERADMIN_STATE })

test("INT-CK-001 tab cookie hiện cài đặt đã lưu", async ({ page }) => {
  await page.goto("/settings?tab=cookie")
  const res = await page.evaluate(async () => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    return (await fetch("/api/v1/settings/admin/cookie", { headers: { Authorization: `Bearer ${token}` } })).json()
  })
  expect(res.result).toBe(true)
  await expect(page.getByLabel("Tiêu đề cookie", { exact: true })).toHaveValue(res.data.cookieTitle ?? "")
  await expect(page.getByRole("switch", { name: "Bật ghi nhận" })).toHaveAttribute("aria-checked", String(!!res.data.enableLogging))
})
