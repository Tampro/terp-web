// @ts-check
/**
 * Super Admin against the REAL backend (project "int", session from superadmin.setup.js). Read-only: nothing is
 * created, changed or deleted, so the shared database is safe. Values are compared with the API itself, not hardcoded.
 * Spec sources: GET /saas/admin/dashboard, /iam/companies + /status-counts, /iam/login-history, /media/stats,
 * /settings/admin/brand.
 */
import { expect, test } from "@playwright/test"

test.skip(!process.env.E2E_SUPERADMIN_USERNAME, "no Super Admin credentials in .env")

/** Calls the backend with the session's token, the same way the app does. @param {import('@playwright/test').Page} page @param {string} path */
async function api(page, path) {
  return page.evaluate(async (p) => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    const res = await fetch(`/api${p}`, { headers: { Authorization: `Bearer ${token}` } })
    return { status: res.status, body: await res.json() }
  }, path)
}

test("INT-001 dashboard hiển thị đúng số công ty và người dùng từ backend @smoke", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible()
  const { status, body } = await api(page, `/v1/saas/admin/dashboard?year=${new Date().getFullYear()}`)
  expect(status).toBe(200)
  const fmt = (/** @type {number} */ n) => n.toLocaleString("vi-VN")
  await expect(page.getByTestId("dash.totalCompanies")).toHaveText(fmt(body.data.totalCompanies))
  await expect(page.getByTestId("dash.totalUsers")).toHaveText(fmt(body.data.totalUsers))
})

test("INT-002 danh sách công ty khớp status-counts của backend", async ({ page }) => {
  await page.goto("/companies")
  const { body } = await api(page, "/v1/iam/companies/status-counts")
  await expect(page.getByRole("tab", { name: `Tất cả (${body.data.all})` })).toBeVisible()
  const total = body.data.all
  const shown = Math.min(total, 20)
  await expect(page.getByText(`Hiển thị ${total === 0 ? 0 : 1}–${shown} / ${total}`)).toBeVisible()
  await expect(page.getByText(/undefined|NaN|Invalid Date/)).toHaveCount(0)
})

test("INT-003 lịch sử đăng nhập có lần đăng nhập Super Admin vừa rồi", async ({ page }) => {
  await page.goto("/companies/login-history?userType=SUPER_ADMIN")
  const username = /** @type {string} */ (process.env.E2E_SUPERADMIN_USERNAME)
  await expect(page.getByRole("row").filter({ hasText: username }).first()).toBeVisible() // newest first: the setup login
})

test("INT-004 thư viện media và cài đặt thương hiệu tải được dữ liệu thật", async ({ page }) => {
  await page.goto("/media")
  const stats = await api(page, "/v1/media/stats")
  expect(stats.status).toBe(200)
  await expect(page.getByText("Tổng số tệp")).toBeVisible()
  await expect(page.getByText(String(stats.body.data.files.toLocaleString("vi-VN")), { exact: true }).first()).toBeVisible()

  await page.goto("/settings")
  const brand = await api(page, "/v1/settings/admin/brand")
  await expect(page.getByLabel("Tiêu đề")).toHaveValue(brand.body.data.titleText ?? "")
})
