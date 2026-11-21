// @ts-check
/**
 * Super Admin › Login History (manual §3.2 "Login History").
 * Spec sources: LoginHistoryController GET /iam/login-history (keyword = username or IP, userType SUPER_ADMIN |
 * COMPANY_USER, page), DELETE /{id}; LoginDto. Location/ISP/timezone from the manual are not recorded by the backend.
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
