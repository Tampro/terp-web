// @ts-check
/**
 * Super Admin › Companies (manual §3.2 "Users (companies)").
 * Spec sources: IAM CompanyController — GET /iam/companies (keyword, status ACTIVE|SUSPENDED, createdFrom/To, page),
 * GET /status-counts, POST (CompanyCreateForm: code [A-Z0-9_] ≤50, admin.username [a-zA-Z0-9._-] 3..100; returns the
 * temporary password once), PUT /{id} (name, email), PUT /{id}/status, POST /{id}/reset-password (newPassword 10..128),
 * DELETE /{id}; ImpersonationController POST /companies/{id}/impersonation → sessionKey sent as X-Act-As-Company.
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { COMPANIES, COUNTS } from "./data.js"

/** @param {import('@playwright/test').Page} page */
async function openCompanies(page, query = "") {
  await mockLoggedIn(page, { superAdmin: true })
  const list = await mockApi(page, "/v1/iam/companies", { method: "GET", body: pageOf(COMPANIES) })
  const counts = await mockApi(page, "/v1/iam/companies/status-counts", { body: ok(COUNTS) })
  await page.goto(`/companies${query}`)
  await expect(page.getByRole("table").getByText("E2E Acme Co., Ltd", { exact: true })).toBeVisible()
  return { list, counts }
}

/** @param {import('@playwright/test').Page} page @param {string} name */
const rowActions = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}`, exact: true })

test("CMP-001 danh sách: tên, mã, gói, trạng thái, số đếm tab; dòng toàn null hiện '-' @smoke", async ({ page }) => {
  await openCompanies(page)
  await expect(page.getByRole("table").getByText("E2E_ACME", { exact: true })).toBeVisible()
  await expect(page.getByText("Công ty TNHH Thương mại Dịch vụ O'Brien Việt Nam")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Tất cả (3)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Chặn đăng nhập (2)" })).toBeVisible()
  await expect(page.getByText("Hiển thị 1–3 / 3")).toBeVisible()
  // all-null row (id 103): rendered, no "undefined"/"NaN"
  await expect(page.getByRole("row").filter({ has: page.getByRole("button", { name: /^Thao tác cho/ }) })).toHaveCount(3)
  await expect(page.getByText(/undefined|NaN|Invalid Date/)).toHaveCount(0)
})

test("CMP-002 tìm kiếm + tab trạng thái → gửi keyword/status, ghi vào URL, giữ khi tải lại", async ({ page }) => {
  const { list } = await openCompanies(page)
  await page.getByRole("textbox", { name: "Tìm kiếm" }).fill("acme")
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click()
  await expect(page).toHaveURL(/keyword=acme/)
  await page.getByRole("tab", { name: /Chặn đăng nhập/ }).click()
  await expect(page).toHaveURL(/status=SUSPENDED/)

  // the newest request carries both filters (wait for it; earlier ones may have only one)
  await expect
    .poll(() => {
      const q = list.requests.at(-1)?.url.searchParams
      return [q?.get("keyword"), q?.get("status")]
    })
    .toEqual(["acme", "SUSPENDED"])

  await page.reload()
  await expect(page.getByRole("textbox", { name: "Tìm kiếm" })).toHaveValue("acme")
  await expect(page.getByRole("tab", { name: /Chặn đăng nhập/ })).toHaveAttribute("aria-selected", "true")
})

test("CMP-003 tạo công ty: validate mã, gửi đúng payload, hiện mật khẩu tạm đúng một lần", async ({ page }) => {
  await openCompanies(page)
  const create = await mockApi(page, "/v1/iam/companies", {
    method: "POST",
    body: ok({
      company: { id: "201", code: "E2E_NEW", name: "E2E New" },
      admin: { user: { username: "e2e.new.admin" }, temporaryPassword: "e2e-sentinel-Temp1!" },
    }),
  })

  await page.getByRole("button", { name: "Tạo công ty" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Mã").fill("e2e-new") // lower-case is upper-cased; "-" is not allowed
  await dialog.getByRole("button", { name: "Tạo", exact: true }).click()
  await expect(dialog.getByText("Chỉ dùng A–Z, 0–9 và _")).toBeVisible()
  expect(create).toHaveLength(0)

  await dialog.getByLabel("Mã").fill("e2e_new")
  await dialog.getByLabel("Tên công ty").fill("E2E New")
  await dialog.getByLabel("Email", { exact: true }).fill("new@example.com")
  await dialog.getByLabel("Tên đăng nhập").fill("e2e.new.admin")
  await dialog.getByLabel("Họ tên").fill("E2E New Admin")
  await dialog.getByLabel("Email quản trị viên").fill("admin@example.com")
  await dialog.getByRole("button", { name: "Tạo", exact: true }).click()

  await expect(dialog.getByTestId("temp-password")).toHaveText("e2e-sentinel-Temp1!")
  expect(create).toEqual([
    {
      code: "E2E_NEW",
      name: "E2E New",
      email: "new@example.com",
      enableLogin: true,
      admin: { username: "e2e.new.admin", email: "admin@example.com", fullName: "E2E New Admin" },
    },
  ])

  await dialog.getByRole("button", { name: "Xong" }).click()
  await page.getByRole("button", { name: "Tạo công ty" }).click()
  await expect(page.getByTestId("temp-password")).toHaveCount(0) // shown once: reopening starts a fresh form
})

test("CMP-004 chặn đăng nhập → PUT status SUSPENDED", async ({ page }) => {
  await openCompanies(page)
  const status = await mockApi(page, "/v1/iam/companies/101/status", { body: ok({ ...COMPANIES[0], status: "SUSPENDED" }) })
  await rowActions(page, "E2E Acme Co., Ltd").click()
  await page.getByRole("menuitem", { name: "Chặn đăng nhập" }).click()
  await expect(page.getByText("Đã chặn đăng nhập: không ai của công ty này đăng nhập được")).toBeVisible()
  expect(status).toEqual([{ status: "SUSPENDED" }])
})

test("CMP-005 sửa công ty gửi name + email (mã không đổi)", async ({ page }) => {
  await openCompanies(page)
  const update = await mockApi(page, "/v1/iam/companies/101", { method: "PUT", body: ok(COMPANIES[0]) })
  await rowActions(page, "E2E Acme Co., Ltd").click()
  await page.getByRole("menuitem", { name: "Sửa" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Mã: E2E_ACME")).toBeVisible()
  await dialog.getByLabel("Tên công ty").fill("E2E Acme Renamed")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog).toBeHidden()
  expect(update).toEqual([{ name: "E2E Acme Renamed", email: "contact@acme.example" }])
})

test("CMP-006 đổi mật khẩu quản trị: 9 ký tự bị chặn, 10 ký tự gửi newPassword", async ({ page }) => {
  await openCompanies(page)
  const reset = await mockApi(page, "/v1/iam/companies/101/reset-password", { body: ok({ username: "acme.admin" }) })
  await rowActions(page, "E2E Acme Co., Ltd").click()
  await page.getByRole("menuitem", { name: "Đổi mật khẩu" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Mật khẩu mới", { exact: true }).fill("Abcdefg1!")
  await dialog.getByLabel("Xác nhận mật khẩu").fill("Abcdefg1!")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog.getByText("Tối thiểu 10 ký tự")).toBeVisible()
  expect(reset).toHaveLength(0)

  await dialog.getByLabel("Mật khẩu mới", { exact: true }).fill("Abcdefgh1!")
  await dialog.getByLabel("Xác nhận mật khẩu").fill("Abcdefgh1!")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(page.getByText("Đã đổi mật khẩu cho acme.admin")).toBeVisible()
  expect(reset).toEqual([{ newPassword: "Abcdefgh1!" }]) // userId omitted = first active COMPANY_ADMIN
})

test("CMP-007 xóa: Hủy không gọi API; Xóa gọi DELETE và tải lại danh sách", async ({ page }) => {
  const { list } = await openCompanies(page)
  const del = await mockApi(page, "/v1/iam/companies/101", { method: "DELETE", body: ok(null) })

  await rowActions(page, "E2E Acme Co., Ltd").click()
  await page.getByRole("menuitem", { name: "Xóa" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Hủy" }).click()
  expect(del.requests).toHaveLength(0)

  const before = list.requests.length
  await rowActions(page, "E2E Acme Co., Ltd").click()
  await page.getByRole("menuitem", { name: "Xóa" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("Không thể hoàn tác")
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
  await expect(page.getByText("Đã xóa công ty")).toBeVisible()
  expect(del.requests).toHaveLength(1)
  await expect.poll(() => list.requests.length).toBe(before + 1)
})

test("CMP-008 lỗi backend khi tạo (IAM_002 mã trùng) → toast message, form vẫn mở", async ({ page }) => {
  await openCompanies(page)
  await mockApi(page, "/v1/iam/companies", { method: "POST", status: 400, body: fail("IAM_002", "Mã công ty đã tồn tại.") })
  await page.getByRole("button", { name: "Tạo công ty" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Mã").fill("E2E_ACME")
  await dialog.getByLabel("Tên công ty").fill("Dup")
  await dialog.getByLabel("Email", { exact: true }).fill("dup@example.com")
  await dialog.getByLabel("Tên đăng nhập").fill("dup.admin")
  await dialog.getByLabel("Họ tên").fill("Dup Admin")
  await dialog.getByLabel("Email quản trị viên").fill("dup.admin@example.com")
  await dialog.getByRole("button", { name: "Tạo", exact: true }).click()
  await expect(page.getByText("Mã công ty đã tồn tại.")).toBeVisible()
  await expect(dialog).toBeVisible()
})

test("CMP-009 đăng nhập với tư cách công ty → gửi X-Act-As-Company, có banner; quay lại thì kết thúc phiên", async ({ page }) => {
  await openCompanies(page)
  await mockApi(page, "/v1/iam/companies/101/impersonation", {
    body: ok({ sessionKey: "e2e-act-as-key", companyId: "101", companyName: "E2E Acme Co., Ltd", expiresAt: "2999-01-01T00:00:00Z" }),
  })
  const end = await mockApi(page, "/v1/iam/impersonation/end", { body: ok(null) })

  await rowActions(page, "E2E Acme Co., Ltd").click()
  await page.getByRole("menuitem", { name: "Đăng nhập với tư cách công ty" }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("status").getByText("Bạn đang đăng nhập với tư cách công ty “E2E Acme Co., Ltd”.")).toBeVisible()
  // every later request carries the session key (mocked /me records it)
  const meReq = page.waitForRequest((r) => r.url().endsWith("/api/v1/me"))
  await page.reload()
  expect((await meReq).headers()["x-act-as-company"]).toBe("e2e-act-as-key")

  await page.getByRole("button", { name: "Quay lại Super Admin" }).click()
  await expect(page).toHaveURL(/\/companies$/)
  expect(end).toEqual([{ sessionKey: "e2e-act-as-key" }])
  expect(end.requests[0].headers["x-act-as-company"]).toBeUndefined() // ending is called without the header
  expect(await page.evaluate(() => sessionStorage.getItem("erp.actAs"))).toBeNull()
})

test("CMP-010 công ty bị chặn: không có 'Đăng nhập với tư cách công ty'", async ({ page }) => {
  await openCompanies(page)
  await rowActions(page, "Công ty TNHH Thương mại Dịch vụ O'Brien Việt Nam").click()
  await expect(page.getByRole("menuitem", { name: "Đăng nhập với tư cách công ty" })).toBeDisabled()
})

test("CMP-011 thông tin công ty: gói, số tài khoản so với giới hạn, quản trị viên", async ({ page }) => {
  await openCompanies(page)
  const info = await mockApi(page, "/v1/iam/companies/101/info", {
    body: ok({ company: COMPANIES[0], userCount: 10, maxUsers: 10, administrators: [{ id: "5", username: "e2e.admin", email: "admin@acme.example", fullName: "E2E Admin", status: "ACTIVE" }] }),
  })
  await rowActions(page, "E2E Acme Co., Ltd").click()
  await page.getByRole("menuitem", { name: "Thông tin công ty" }).click()
  const dlg = page.getByRole("dialog")
  await expect(dlg.getByTestId("company-accounts")).toContainText("10 / 10")
  await expect(dlg.getByTestId("company-accounts")).toContainText("Đã đạt giới hạn")
  await expect(dlg.getByText("E2E Admin")).toBeVisible()
  await expect(dlg.getByText("E2E Pro")).toBeVisible()
  expect(info.length).toBeGreaterThan(0)
})

test("CMP-012 nâng cấp gói: gói không có giá năm thì khóa Theo năm; gửi planId + billingCycle", async ({ page }) => {
  await openCompanies(page)
  await mockApi(page, "/v1/saas/admin/plans", {
    body: ok([
      { id: "1", name: "E2E Starter", monthlyPrice: 100000, yearlyPrice: null, enabled: true },
      { id: "2", name: "E2E Pro", monthlyPrice: 200000, yearlyPrice: 2000000, enabled: true },
      { id: "3", name: "E2E Old", monthlyPrice: 1, enabled: false },
    ]),
  })
  const put = await mockApi(page, "/v1/iam/companies/101/plan", { method: "PUT", body: ok({ id: "9", status: "APPROVED" }) })
  await rowActions(page, "E2E Acme Co., Ltd").click()
  await page.getByRole("menuitem", { name: "Nâng cấp gói" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByRole("combobox", { name: "Gói" }).click()
  await expect(page.getByRole("option", { name: "E2E Old" })).toHaveCount(0)
  await page.getByRole("option", { name: "E2E Starter" }).click()
  await expect(dlg.getByText("Gói này không có giá theo năm.")).toBeVisible()
  await dlg.getByRole("combobox", { name: "Chu kỳ thanh toán" }).click()
  await expect(page.getByRole("option", { name: "Theo năm" })).toBeDisabled()
  await page.keyboard.press("Escape")
  await dlg.getByRole("combobox", { name: "Gói" }).click()
  await page.getByRole("option", { name: "E2E Pro" }).click()
  await dlg.getByRole("combobox", { name: "Chu kỳ thanh toán" }).click()
  await page.getByRole("option", { name: "Theo năm" }).click()
  await expect(dlg.getByTestId("upgrade-summary")).toContainText("2.000.000")
  await dlg.getByRole("button", { name: "Nâng cấp" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ planId: 2, billingCycle: "YEARLY" })
})

test("CMP-013 xem dạng lưới: giữ trong URL, mỗi công ty là một thẻ có thao tác", async ({ page }) => {
  await openCompanies(page)
  await page.getByRole("button", { name: "Xem dạng lưới" }).click()
  await expect(page).toHaveURL(/view=grid/)
  const grid = page.getByTestId("companies-grid")
  await expect(grid.getByText("E2E Acme Co., Ltd")).toBeVisible()
  await expect(grid.getByRole("button", { name: /^Thao tác cho/ })).toHaveCount(3)
  await page.reload()
  await expect(page.getByTestId("companies-grid")).toBeVisible()
  await page.getByRole("button", { name: "Xem dạng danh sách" }).click()
  await expect(page.getByRole("table")).toBeVisible()
})
