// @ts-check
/** Notification delivery log against the REAL backend, read-only: the first row matches GET /v1/notifications/deliveries. */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES } from "../../playwright.config.js"

test.skip(!fs.existsSync(COMPANY_STATES.companyAdmin), "no companyAdmin session")
test.use({ storageState: COMPANY_STATES.companyAdmin })

test("INT-NTF-001 nhật ký thông báo của công ty khớp backend", async ({ page }) => {
  await page.goto("/notifications")
  const res = await page.evaluate(async () => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    return (await fetch("/api/v1/notifications/deliveries?page=0&size=20", { headers: { Authorization: `Bearer ${token}` } })).json()
  })
  expect(res.result).toBe(true)
  const rows = res.data.content ?? []
  if (!rows.length) await expect(page.getByText("Chưa có thông báo nào được gửi.")).toBeVisible()
  else await expect(page.getByRole("row").filter({ hasText: rows[0].target ?? rows[0].eventType }).first()).toContainText(rows[0].eventType)
})
