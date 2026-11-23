// @ts-check
/**
 * Super Admin › Login History (manual §3.2 "Login History").
 * Spec sources: LoginHistoryController GET /iam/login-history (keyword = username or IP, ipAddress exact, companyId,
 * userType SUPER_ADMIN | COMPANY_USER, page), GET /{id} (User-Agent), DELETE /{id}; LoginDto (deviceType, language,
 * timezone, roleAtLogin; city / country / isp null until the backend has a GeoIP source).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { LOGINS } from "./data.js"

test("LH-001 danh sách đăng nhập, lọc loại người dùng và tìm IP", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  const list = await mockApi(page, "/v1/iam/login-history", { method: "GET", body: pageOf(LOGINS) })

  await page.goto("/companies/login-history")
  const row = page.getByRole("row").filter({ hasText: "e2e.superadmin" })
  await expect(row).toContainText("10.0.0.9")
  await expect(row).toContainText("Chrome · Windows")
  // null browser/os/time → "-"
  await expect(page.getByRole("row").filter({ hasText: "acme.admin" })).toContainText("-")

  await page.getByRole("combobox", { name: "Loại người dùng" }).click()
  await page.getByRole("option", { name: "Super Admin" }).click()
  await page.getByRole("textbox", { name: "Tìm kiếm" }).fill("10.0.0.9")
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click()

  await expect
    .poll(() => {
      const q = list.requests.at(-1)?.url.searchParams
      return [q?.get("keyword"), q?.get("userType")]
    })
    .toEqual(["10.0.0.9", "SUPER_ADMIN"])
  await expect(page).toHaveURL(/userType=SUPER_ADMIN/)
})

test("LH-002 xóa một bản ghi đăng nhập", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/iam/login-history", { method: "GET", body: pageOf(LOGINS) })
  const del = await mockApi(page, "/v1/iam/login-history/8", { method: "DELETE", body: ok(null) })

  await page.goto("/companies/login-history")
  await page.getByRole("button", { name: "Xóa lần đăng nhập của acme.admin" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
  await expect.poll(() => del.requests.length).toBe(1)
})

test("LH-003 cột thiết bị, ngôn ngữ, vai trò; bấm IP thì lọc đúng IP; lọc công ty; xem chi tiết User-Agent", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/iam/companies", { body: pageOf([{ id: "3", name: "E2E Co" }]) })
  const ROW = { id: "77", userId: "9", companyId: "3", username: "e2e.mobile", userType: "COMPANY_USER", ipAddress: "10.1.2.3", browser: "Safari", os: "iOS", deviceType: "MOBILE", language: "vi-VN", timezone: "Asia/Ho_Chi_Minh", roleAtLogin: "COMPANY_ADMIN", city: null, country: null, isp: null, loginAt: "2026-11-23T01:00:00Z" }
  const list = await mockApi(page, "/v1/iam/login-history", { method: "GET", body: pageOf([ROW]) })
  const one = await mockApi(page, "/v1/iam/login-history/77", { method: "GET", body: ok({ ...ROW, userAgent: "E2E-Agent/1.0 (iPhone)" }) })
  await page.goto("/companies/login-history")
  const row = page.getByRole("row").filter({ hasText: "e2e.mobile" })
  await expect(row).toContainText("COMPANY_ADMIN")
  await expect(row).toContainText("E2E Co")
  await expect(row).toContainText("Chưa thu thập")
  await expect(row).toContainText("vi-VN")
  await expect(row).toContainText("Asia/Ho_Chi_Minh")
  await row.getByRole("button", { name: "10.1.2.3" }).click()
  await expect(page.getByTestId("ip-filter")).toContainText("10.1.2.3")
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("ipAddress")).toBe("10.1.2.3")
  await page.getByRole("combobox", { name: "Công ty" }).click()
  await page.getByRole("option", { name: "E2E Co" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("companyId")).toBe("3")
  await row.getByRole("button", { name: "Chi tiết lần đăng nhập của e2e.mobile" }).click()
  await expect(page.getByTestId("login-detail")).toContainText("E2E-Agent/1.0 (iPhone)")
  await expect(page.getByTestId("login-detail")).toContainText("Điện thoại")
  expect(one.length).toBeGreaterThan(0)
})
