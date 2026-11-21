// @ts-check
/**
 * §4 against the REAL backend as Super Admin (project "int"). Read-only: nothing is created, approved or deleted.
 * The screen is compared with the API's own answer. Spec: GET /saas/admin/plans, /saas/admin/orders/status-counts,
 * /saas/admin/coupons/status-counts, /saas/admin/plan-requests/status-counts.
 */
import { expect, test } from "@playwright/test"

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
