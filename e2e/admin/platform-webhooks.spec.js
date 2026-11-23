// @ts-check
/**
 * §3.7 Platform webhooks. Spec: iam-service PlatformWebhookController /v1/settings/admin/webhooks (super admin):
 * events catalog, list, POST / PUT PlatformWebhookForm {eventCode, url https, method POST, active, secret 16..200
 * write-only, removeSecret (update)}, DELETE, POST /{id}/test; deliveries GET /v1/notifications/deliveries?platform=true.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const EVENTS = [
  { code: "NEW_COMPANY", name: "New Company", eventType: "platform.company.created" },
  { code: "NEW_ORDER", name: "New Plan Order", eventType: "platform.order.created" },
]
const ROW = { id: "5", eventCode: "NEW_ORDER", eventName: "New Plan Order", url: "https://hooks.example.com/e2e", method: "POST", active: true, hasSecret: true }

/** @param {import('@playwright/test').Page} page */
async function open(page) {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/webhooks/events", { body: ok(EVENTS) })
  await mockApi(page, "/v1/settings/admin/webhooks", { method: "GET", body: pageOf([ROW]) })
  await page.goto("/settings?tab=webhooks")
  await expect(page.getByRole("row").filter({ hasText: "New Plan Order" })).toContainText("https://hooks.example.com/e2e")
}

test("PWH-001 thêm webhook: chỉ https, khóa ký ≥16 ký tự; gửi method POST @smoke", async ({ page }) => {
  await open(page)
  const create = await mockApi(page, "/v1/settings/admin/webhooks", { method: "POST", body: ok({ id: "6" }) })
  await page.getByRole("button", { name: "Thêm webhook" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByRole("combobox", { name: "Sự kiện" }).click()
  await page.getByRole("option", { name: "New Company" }).click()
  await dlg.getByLabel("URL *").fill("http://hooks.example.com/x")
  await dlg.getByLabel("Khóa ký (tùy chọn)").fill("short")
  await expect(dlg.getByText("Dùng địa chỉ https://")).toBeVisible()
  await expect(dlg.getByText("Ít nhất 16 ký tự")).toBeVisible()
  await expect(dlg.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
  await dlg.getByLabel("URL *").fill("https://hooks.example.com/new")
  await dlg.getByLabel("Khóa ký (tùy chọn)").fill("e2e-secret-0123456789")
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ eventCode: "NEW_COMPANY", url: "https://hooks.example.com/new", method: "POST", active: true, secret: "e2e-secret-0123456789" })
})

test("PWH-002 sửa: để trống khóa thì giữ, bật Xóa khóa thì gửi removeSecret; gửi thử qua xác nhận", async ({ page }) => {
  await open(page)
  const put = await mockApi(page, "/v1/settings/admin/webhooks/5", { method: "PUT", body: ok(ROW) })
  const testCall = await mockApi(page, "/v1/settings/admin/webhooks/5/test", { method: "POST", body: ok({ status: "SENT" }) })
  await page.getByRole("button", { name: /Thao tác cho New Plan Order/ }).click()
  await page.getByRole("menuitem", { name: "Sửa" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByRole("switch", { name: "Xóa khóa ký đã lưu" }).click()
  await expect(dlg.getByLabel("Khóa ký (tùy chọn)")).toHaveCount(0)
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ eventCode: "NEW_ORDER", url: "https://hooks.example.com/e2e", method: "POST", active: true, removeSecret: true })
  await page.getByRole("button", { name: /Thao tác cho New Plan Order/ }).click()
  await page.getByRole("menuitem", { name: "Gửi thử" }).click()
  await page.getByRole("alertdialog").getByRole("button").last().click()
  await expect.poll(() => testCall.length).toBe(1)
})

test("PWH-003 nhật ký thông báo: Super Admin chọn Nền tảng thì gửi platform=true, không gửi companyId", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/iam/companies", { body: pageOf([]) })
  const list = await mockApi(page, "/v1/notifications/deliveries", { body: pageOf([{ id: "1", eventType: "platform.order.created", channel: "WEBHOOK", target: "https://hooks.example.com/e2e", status: "SENT", attempts: 1, createdDate: "2026-11-23T01:00:00Z" }]) })
  await page.goto("/notifications?companyId=platform")
  await expect(page.getByRole("row").filter({ hasText: "platform.order.created" })).toBeVisible()
  const q = /** @type {URL} */ (list.requests.at(-1)?.url).searchParams
  expect(q.get("platform")).toBe("true")
  expect(q.get("companyId")).toBeNull()
})

test("PWH-004 gửi thử bị đích từ chối (delivered=false) thì báo lỗi kèm mã HTTP, không báo thành công", async ({ page }) => {
  await open(page)
  await mockApi(page, "/v1/settings/admin/webhooks/5/test", { method: "POST", body: ok({ delivered: false, statusCode: 405, failure: null }) })
  await page.getByRole("button", { name: /Thao tác cho New Plan Order/ }).click()
  await page.getByRole("menuitem", { name: "Gửi thử" }).click()
  await page.getByRole("alertdialog").getByRole("button").last().click()
  await expect(page.getByText("Gửi thử không thành công: HTTP 405")).toBeVisible()
})
