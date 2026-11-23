// @ts-check
/**
 * §3.3 helpdesk against the REAL backend, read-only. Company Admin: GET /v1/helpdesk/tickets lists their company's
 * tickets; Super Admin: the stats tab matches GET /v1/helpdesk/stats.
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES, SUPERADMIN_STATE } from "../../playwright.config.js"

/** @param {import('@playwright/test').Page} page @param {string} path */
async function api(page, path) {
  return page.evaluate(async (p) => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    const r = await fetch(`/api${p}`, { headers: { Authorization: `Bearer ${token}` } })
    return r.json()
  }, path)
}

test.describe("company", () => {
  test.skip(!fs.existsSync(COMPANY_STATES.companyAdmin), "no companyAdmin session")
  test.use({ storageState: COMPANY_STATES.companyAdmin })
  test("INT-HD-001 danh sách yêu cầu của công ty khớp backend", async ({ page }) => {
    await page.goto("/helpdesk")
    const res = await api(page, "/v1/helpdesk/tickets?page=0&size=20")
    expect(res.result).toBe(true)
    const rows = res.data.content ?? []
    if (!rows.length) await expect(page.getByText("Chưa có dữ liệu.")).toBeVisible()
    else await expect(page.getByRole("row").filter({ hasText: rows[0].ticketNumber })).toContainText(rows[0].title)
  })
})

test.describe("super admin", () => {
  test.skip(!fs.existsSync(SUPERADMIN_STATE), "no superadmin session")
  test.use({ storageState: SUPERADMIN_STATE })
  test("INT-HD-002 tab thống kê khớp /helpdesk/stats", async ({ page }) => {
    await page.goto("/helpdesk?tab=stats")
    const res = await api(page, `/v1/helpdesk/stats?year=${new Date().getFullYear()}`)
    expect(res.result).toBe(true)
    await expect(page.getByTestId("hd-total")).toHaveText(String(res.data.total))
  })
})
