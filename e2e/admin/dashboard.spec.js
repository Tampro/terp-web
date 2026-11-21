// @ts-check
/**
 * Super Admin dashboard + access (manual §3.1).
 * Spec sources: GET /api/v1/saas/admin/dashboard?year= (AdminDashboardService.AdminDashboard),
 * @PermissionChecker.isSuperAdmin on every /iam/companies, /settings/admin endpoint; MeDto.superAdmin.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"
import { DASHBOARD } from "./data.js"

test("DASH-001 Super Admin thấy số liệu dashboard từ API @smoke", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  const calls = await mockApi(page, "/v1/saas/admin/dashboard", { body: ok(DASHBOARD) })

  await page.goto("/dashboard")

  await expect(page.getByTestId("dash.totalCompanies")).toHaveText("3")
  await expect(page.getByText("1 đang hoạt động")).toBeVisible()
  await expect(page.getByTestId("dash.totalUsers")).toHaveText("17")
  await expect(page.getByTestId("dash.pendingRequests")).toHaveText("4")
  await expect(page.getByTestId("dash.totalRevenue")).toHaveText("12.345,5") // vi-VN grouping
  await expect(page.getByText("E2E Acme Co., Ltd")).toBeVisible()
  expect(calls.requests[0].url.searchParams.get("year")).toBe(String(new Date().getFullYear()))
})

test("DASH-002 đổi năm → gọi lại dashboard với year mới", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  const calls = await mockApi(page, "/v1/saas/admin/dashboard", { body: ok(DASHBOARD) })
  const lastYear = String(new Date().getFullYear() - 1)

  await page.goto("/dashboard")
  await expect(page.getByTestId("dash.totalCompanies")).toHaveText("3")
  await page.getByRole("combobox", { name: "Năm" }).click()
  await page.getByRole("option", { name: lastYear }).click()

  await expect.poll(() => calls.requests.map((r) => r.url.searchParams.get("year"))).toContain(lastYear)
})

test("DASH-003 lỗi API → hiện message backend, không có số liệu giả", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/saas/admin/dashboard", {
    status: 500,
    body: { result: false, code: "SYS_001", message: "Lỗi hệ thống." },
  })
  await page.goto("/dashboard")
  await expect(page.getByRole("alert").getByText("Lỗi hệ thống.", { exact: true })).toBeVisible()
  await expect(page.getByTestId("dash.totalCompanies")).toHaveText("-")
})

test("ADM-001 người dùng công ty: không có menu Super Admin, mở /companies thì báo không có quyền", async ({ page }) => {
  await mockLoggedIn(page) // company user
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Tester" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Công ty" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Cài đặt" })).toHaveCount(0)

  await page.goto("/companies")
  await expect(page.getByRole("heading", { name: "Không có quyền" })).toBeVisible()
})

test("ADM-002 Super Admin thấy đủ menu Công ty, Thư viện media, Cài đặt", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/saas/admin/dashboard", { body: ok(DASHBOARD) })
  await page.goto("/dashboard")
  const nav = page.getByRole("navigation").or(page.locator("[data-sidebar=sidebar]"))
  for (const name of ["Công ty", "Thư viện media", "Cài đặt"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible()
  }
})
