// @ts-check
/** §3.1 Super Admin dashboard against the REAL backend, read-only: new cards and helpdesk figures match the APIs. */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { SUPERADMIN_STATE } from "../../playwright.config.js"

test.skip(!fs.existsSync(SUPERADMIN_STATE), "no superadmin session")
test.use({ storageState: SUPERADMIN_STATE })

test("INT-DASH-002 Tổng đơn hàng và trạng thái helpdesk khớp backend", async ({ page }) => {
  await page.goto("/dashboard")
  const get = (/** @type {string} */ p) =>
    page.evaluate(async (path) => {
      const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
      return (await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })).json()
    }, p)
  const year = new Date().getFullYear()
  const dash = (await get(`/v1/saas/admin/dashboard?year=${year}`)).data
  const hd = (await get(`/v1/helpdesk/stats?year=${year}`)).data
  await expect(page.getByTestId("dash.totalOrders")).toHaveText(String(dash.totalOrders))
  await expect(page.getByTestId("dash-hd-OPEN")).toContainText(String(hd.byStatus?.OPEN ?? 0))
  await expect(page.getByTestId("dash-hd-CLOSED")).toContainText(String(hd.byStatus?.CLOSED ?? 0))
})
