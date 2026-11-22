// @ts-check
/**
 * §15 Events against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only.
 * Spec: GET /v1/meeting/events and /events/calendar (approved events only).
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES } from "../../playwright.config.js"

test.skip(!fs.existsSync(COMPANY_STATES.companyAdmin), "no companyAdmin session")
test.use({ storageState: COMPANY_STATES.companyAdmin })

test("INT-EV danh sách sự kiện khớp GET /meeting/events", async ({ page }) => {
  await page.goto("/hrm/events")
  const res = await page.evaluate(async () => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    const r = await fetch("/api/v1/meeting/events?page=0&size=20", { headers: { Authorization: `Bearer ${token}` } })
    return r.json()
  })
  expect(res.result).toBe(true)
  const rows = res.data.content ?? []
  if (!rows.length) await expect(page.getByText("Chưa có dữ liệu.")).toBeVisible()
  else await expect(page.getByRole("row").filter({ hasText: rows[0].title }).first()).toBeVisible()
})
