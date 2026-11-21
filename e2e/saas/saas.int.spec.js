// @ts-check
/**
 * §4 against the REAL backend as Super Admin (project "int"). Read-only: nothing is created, approved or deleted.
 * The screen is compared with the API's own answer. Spec: GET /saas/admin/plans, /saas/admin/orders/status-counts,
 * /saas/admin/coupons/status-counts, /saas/admin/plan-requests/status-counts.
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES } from "../../playwright.config.js"
import saasVi from "../../src/locales/saas/vi.ts"

test.skip(!process.env.E2E_SUPERADMIN_USERNAME, "no Super Admin credentials in .env")

/** @param {import('@playwright/test').Page} page @param {string} path */
async function api(page, path) {
  return page.evaluate(async (p) => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    const res = await fetch(`/api${p}`, { headers: { Authorization: `Bearer ${token}` } })
    return { status: res.status, body: await res.json() }
  }, path)
}

test("INT-SAAS-001 trang Gói hiển thị đúng các gói của backend @smoke", async ({ page }) => {
  await page.goto("/plans")
  await expect(page.getByRole("heading", { name: "Gói dịch vụ" })).toBeVisible()
  const { status, body } = await api(page, "/v1/saas/admin/plans")
  expect(status).toBe(200)
  for (const plan of body.data) {
    await expect(page.getByText(plan.name, { exact: true }).first()).toBeVisible()
  }
  await expect(page.getByRole("button", { name: /^Thao tác cho gói / })).toHaveCount(body.data.length)
})

test("INT-SAAS-002 số đếm tab Đơn hàng, Yêu cầu gói, Mã giảm giá khớp backend", async ({ page }) => {
  await page.goto("/orders")
  const orders = await api(page, "/v1/saas/admin/orders/status-counts")
  await expect(page.getByRole("tab", { name: `Tất cả (${orders.body.data.all})` })).toBeVisible()
  await expect(page.getByRole("tab", { name: `Chờ duyệt (${orders.body.data.pending})` })).toBeVisible()

  await page.goto("/plan-requests")
  const requests = await api(page, "/v1/saas/admin/plan-requests/status-counts")
  await expect(page.getByRole("tab", { name: `Tất cả (${requests.body.data.all})` })).toBeVisible()

  await page.goto("/coupons")
  const coupons = await api(page, "/v1/saas/admin/coupons/status-counts")
  await expect(page.getByRole("tab", { name: `Tất cả (${coupons.body.data.all})` })).toBeVisible()
  await expect(page.getByText(/undefined|NaN|Invalid Date/)).toHaveCount(0)
})

// Company side of §4 with the real Company Admin (e2e/company.setup.js). Read-only: nothing is ordered or requested.
test.describe("company admin", () => {
  test.skip(!fs.existsSync(COMPANY_STATES.companyAdmin), "no companyAdmin session")
  test.use({ storageState: COMPANY_STATES.companyAdmin })

  test("INT-SAAS-010 công ty: trang Gói hiện các gói bán, Đơn hàng hiện đơn của công ty, khớp backend", async ({ page }) => {
    await page.goto("/plans")
    const plans = await api(page, "/v1/saas/plans")
    expect(plans.status).toBe(200)
    for (const plan of plans.body.data) await expect(page.getByText(plan.name, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/undefined|NaN|Invalid Date/)).toHaveCount(0)

    await page.goto("/orders")
    const orders = await api(page, "/v1/saas/orders?page=0&size=10")
    expect(orders.status).toBe(200)
    const rows = orders.body.data.content ?? []
    for (const o of rows) await expect(page.getByText(o.orderNumber, { exact: true })).toBeVisible()
    if (!rows.length) await expect(page.getByText(saasVi["orders.empty"])).toBeVisible()
    await expect(page.getByText(/undefined|NaN|Invalid Date/)).toHaveCount(0)
  })
})
