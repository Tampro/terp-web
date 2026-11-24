// @ts-check
/**
 * Company system settings (manual §19). Spec sources: iam-service RoleController (RoleForm {code [A-Z][A-Z0-9_]*, name,
 * description, permissions}; GET /iam/roles is an array), UserController (UserCreateForm; /roles UserRolesForm; /status),
 * CompanySettingsController (PUT = full replacement; empty = platform value), EmailNotificationController (ToggleForm),
 * WebhookService (secret 16..200, write-only).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["IAM_USER_VIEW", "IAM_USER_CREATE", "IAM_USER_UPDATE", "IAM_ROLE_VIEW", "IAM_ROLE_CREATE", "IAM_ROLE_UPDATE", "IAM_ROLE_DELETE", "IAM_PERMISSION_VIEW", "IAM_SETTINGS_MANAGE", "NOTIFICATION_SETTINGS_UPDATE"]
const ROLES = [
  { id: "306", code: "COMPANY_ADMIN", name: "Company administrator", systemRole: true, permissions: ["CUSTOMER_VIEW"] },
  { id: "310", code: "EMPLOYEE", name: "Employee", systemRole: true, permissions: [] },
]

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/iam/roles", { method: "GET", body: ok(ROLES) })
}
/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("CO-001 vai trò: mã in hoa, chọn cả phân hệ trong ma trận quyền, gửi RoleForm @smoke", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/iam/permissions", {
    body: ok([
      { code: "CUSTOMER_VIEW", module: "CUSTOMER", description: "View customers" },
      { code: "CUSTOMER_MANAGE", module: "CUSTOMER", description: "Manage customers" },
      { code: "VENDOR_VIEW", module: "VENDOR", description: "View vendors" },
    ]),
  })
  const save = await mockApi(page, "/v1/iam/roles", { method: "POST", body: ok({ id: "400" }) })
  await page.goto("/company/access?tab=roles")
  await page.getByRole("button", { name: "Thêm vai trò" }).click()
  const d = page.getByRole("dialog")
  await d.getByLabel("Mã").fill("1abc")
  await expect(d.getByText("Chữ in hoa, số và gạch dưới, bắt đầu bằng chữ")).toBeVisible()
  await d.getByLabel("Mã").fill("demo_acc")
  await expect(d.getByLabel("Mã")).toHaveValue("DEMO_ACC")
  await d.getByLabel("Tên").fill("E2E Accountant")
  await d.getByRole("checkbox", { name: "Cả phân hệ CUSTOMER" }).click()
  await d.getByRole("checkbox", { name: "VENDOR_VIEW" }).click()
  await expect(d.getByTestId("perm-count")).toHaveText("Đã chọn 3 quyền")
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ code: "DEMO_ACC", name: "E2E Accountant", permissions: ["CUSTOMER_MANAGE", "CUSTOMER_VIEW", "VENDOR_VIEW"] })
})

test("CO-002 người dùng: tạo gửi UserCreateForm; đổi vai trò điền sẵn vai trò hiện tại; khóa đăng nhập", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/iam/users", { method: "GET", body: pageOf([{ id: "77", username: "e2e.thu", fullName: "E2E Thu", email: "thu@example.com", status: "ACTIVE", roles: ["EMPLOYEE"] }]) })
  const create = await mockApi(page, "/v1/iam/users", { method: "POST", body: ok({ id: "78" }) })
  const roles = await mockApi(page, "/v1/iam/users/77/roles", { method: "PUT", body: ok({}) })
  const status = await mockApi(page, "/v1/iam/users/77/status", { method: "PUT", body: ok({}) })
  await page.goto("/company/access")
  await page.getByRole("button", { name: "Thêm người dùng" }).click()
  const d = page.getByRole("dialog")
  await d.getByLabel("Tên đăng nhập *").fill("e2e.lan")
  await d.getByLabel("Email *").fill("lan@example.com")
  await d.getByLabel("Họ tên *").fill("E2E Lan")
  await d.getByRole("checkbox", { name: "Employee" }).check()
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ username: "e2e.lan", email: "lan@example.com", fullName: "E2E Lan", roleIds: [310] })

  await menu(page, "E2E Thu").click()
  await page.getByRole("menuitem", { name: "Đổi vai trò" }).click()
  const r = page.getByRole("dialog")
  await expect(r.getByRole("checkbox", { name: "Employee" })).toBeChecked()
  await r.getByRole("checkbox", { name: "Company administrator" }).check()
  await r.getByRole("button", { name: "Đổi vai trò" }).click()
  await expect.poll(() => roles.length).toBe(1)
  expect([.../** @type {any} */ (roles[0]).roleIds].sort()).toEqual([306, 310])

  await menu(page, "E2E Thu").click()
  await page.getByRole("menuitem", { name: "Khóa đăng nhập" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Khóa đăng nhập" }).click()
  await expect.poll(() => status.length).toBe(1)
  expect(status[0]).toEqual({ status: "LOCKED" })
})

test("CO-010 cài đặt công ty: hồ sơ (mã số thuế chỉ khi bật) gửi CompanyProfile; tiền tệ chặn dấu phân cách trùng", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/settings/company/profile", { method: "GET", body: ok({ accountName: "E2E Co", taxNumberEnabled: false, taxType: "VAT" }) })
  const profile = await mockApi(page, "/v1/settings/company/profile", { method: "PUT", body: ok({}) })
  await mockApi(page, "/v1/settings/company/currency", { method: "GET", body: ok({}) })
  await page.goto("/company/settings")
  await expect(page.getByLabel("Mã số thuế", { exact: true })).toHaveCount(0)
  await page.getByLabel("Tên công ty").fill("E2E Vietnam")
  await page.getByRole("switch", { name: "Hiện mã số thuế" }).click()
  await page.getByLabel("Mã số thuế", { exact: true }).fill("0312345678")
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => profile.length).toBe(1)
  expect(profile[0]).toEqual({ name: "E2E Vietnam", taxNumberEnabled: true, taxType: "VAT", taxNumber: "0312345678" })

  await page.getByRole("tab", { name: "Tiền tệ" }).click()
  await page.getByRole("combobox", { name: "Dấu thập phân" }).click()
  await page.getByRole("option", { name: "Dấu phẩy (,)" }).click()
  await page.getByRole("combobox", { name: "Dấu phân cách nghìn" }).click()
  await page.getByRole("option", { name: "Dấu phẩy (,)" }).click()
  await expect(page.getByText("Phải khác dấu thập phân")).toBeVisible()
  await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
})

test("CO-020 thông báo email bật/tắt (ToggleForm); webhook secret ≥16 ký tự, gửi WebhookForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/settings/email-notifications", { method: "GET", body: ok([{ module: "GENERAL", notifications: [{ code: "PAYMENT_REMINDER", name: "Payment Reminder", enabled: true, dispatched: false }] }]) })
  const toggle = await mockApi(page, "/v1/settings/email-notifications/PAYMENT_REMINDER", { method: "PUT", body: ok({}) })
  await mockApi(page, "/v1/settings/webhooks/events", { body: ok([{ module: "SALES", events: [{ code: "NEW_SALES_INVOICE", name: "New Sales Invoice" }] }]) })
  await mockApi(page, "/v1/settings/webhooks", { method: "GET", body: pageOf([]) })
  const hook = await mockApi(page, "/v1/settings/webhooks", { method: "POST", body: ok({ id: "1" }) })
  await page.goto("/company/settings?tab=notifications")
  await expect(page.getByText("(chưa được gửi)")).toBeVisible()
  await page.getByRole("switch", { name: "Payment Reminder" }).click()
  await expect.poll(() => toggle.length).toBe(1)
  expect(toggle[0]).toEqual({ enabled: false })

  await page.getByRole("tab", { name: "Webhook" }).click()
  await page.getByRole("button", { name: "Thêm webhook" }).click()
  const d = page.getByRole("dialog")
  await d.getByRole("combobox", { name: "Sự kiện" }).click()
  await page.getByRole("option", { name: "Bán hàng · New Sales Invoice" }).click()
  await d.getByLabel("URL *").fill("https://hooks.example.com/erp")
  await d.getByLabel("Khóa ký (tùy chọn)").fill("short")
  await expect(d.getByText("Ít nhất 16 ký tự")).toBeVisible()
  await d.getByLabel("Khóa ký (tùy chọn)").fill("e2e-secret-0123456789")
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => hook.length).toBe(1)
  expect(hook[0]).toEqual({ method: "POST", eventCode: "NEW_SALES_INVOICE", url: "https://hooks.example.com/erp", secret: "e2e-secret-0123456789", active: true })
})

test("CO-020 người dùng: cột số di động, lọc theo vai trò gửi roleId; vai trò có số người dùng; lịch sử đăng nhập có thiết bị và vai trò", async ({ page }) => {
  await base(page)
  const users = await mockApi(page, "/v1/iam/users", { method: "GET", body: pageOf([{ id: "77", username: "e2e.thu", fullName: "E2E Thu", email: "thu@example.com", mobile: "+84 90 111 2222", status: "ACTIVE", roles: ["EMPLOYEE"] }]) })
  await mockApi(page, "/v1/iam/login-history", { method: "GET", body: pageOf([{ id: "5", username: "e2e.thu", loginAt: "2026-11-24T08:00:00Z", ipAddress: "10.0.0.1", browser: "Chrome", os: "Windows", deviceType: "DESKTOP", timezone: "Asia/Ho_Chi_Minh", roleAtLogin: "EMPLOYEE" }]) })
  await page.goto("/company/access")
  await expect(page.getByRole("cell", { name: "+84 90 111 2222" })).toBeVisible()
  await page.getByRole("combobox", { name: "Lọc theo vai trò" }).click()
  await page.getByRole("option", { name: "Employee" }).click()
  await expect(page).toHaveURL(/role=310/)
  await expect.poll(() => users.requests.some((r) => r.url.searchParams.get("roleId") === "310" && r.url.searchParams.get("size") !== "1")).toBe(true)
  await page.goto("/company/access?tab=roles")
  // one /iam/users?roleId&size=1 per role; the mock answers 1 user each
  await expect(page.getByRole("row", { name: /Employee/ }).getByRole("cell", { name: "1", exact: true }).first()).toBeVisible()
  expect(users.requests.filter((r) => r.url.searchParams.get("size") === "1").map((r) => r.url.searchParams.get("roleId")).sort()).toEqual(["306", "310"])
  await page.goto("/company/access?tab=logins")
  await expect(page.getByRole("cell", { name: "Máy tính" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Asia/Ho_Chi_Minh" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "EMPLOYEE" })).toBeVisible()
})
