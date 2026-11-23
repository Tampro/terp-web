// @ts-check
/**
 * Notification delivery log. Spec: notification-service DeliveryController /v1/notifications/deliveries
 * (NOTIFICATION_LOG_VIEW; filters status, channel, eventType, from inclusive / to exclusive instants; super admin needs
 * companyId, NTF_001), POST /{id}/retry (NOTIFICATION_LOG_MANAGE, FAILED only).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const FAILED = { id: "7", companyId: "3", eventId: "ev-1", eventType: "sales.invoice.posted", channel: "SLACK", target: "https://hooks.example.com/x", status: "FAILED", attempts: 5, lastErrorCode: "HTTP_500", createdDate: "2026-11-22T03:00:00Z" }
const SENT = { ...FAILED, id: "8", channel: "EMAIL", target: "a@example.com", status: "SENT", attempts: 1, lastErrorCode: null, sentAt: "2026-11-22T03:00:05Z" }

test("NTF-001 công ty: danh sách, lọc kênh và khoảng ngày, xem chi tiết @smoke", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["NOTIFICATION_LOG_VIEW"] })
  const list = await mockApi(page, "/v1/notifications/deliveries", { body: pageOf([FAILED, SENT]) })
  await page.goto("/notifications")
  await expect(page.getByRole("row").filter({ hasText: "a@example.com" })).toContainText("Đã gửi")
  // no MANAGE: no row actions
  await expect(page.getByRole("button", { name: /Thao tác cho/ })).toHaveCount(0)
  await expect(page.getByRole("row").filter({ hasText: "HTTP_500" })).toContainText("Thất bại")
  await page.getByRole("combobox", { name: "Trạng thái" }).click()
  await page.getByRole("option", { name: "Thất bại" }).click()
  await page.getByRole("combobox", { name: "Kênh" }).click()
  await page.getByRole("option", { name: "Slack" }).click()
  await page.getByLabel("Từ ngày").fill("2026-11-22")
  await page.getByLabel("Đến ngày").fill("2026-11-22")
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("to")).toBeTruthy()
  const q = /** @type {URL} */ (list.requests.at(-1)?.url).searchParams
  expect(q.get("channel")).toBe("SLACK")
  expect(q.get("status")).toBe("FAILED")
  expect(q.get("companyId")).toBeNull()
  // to is exclusive: the day after, at local midnight
  expect(new Date(String(q.get("to"))).getTime() - new Date(String(q.get("from"))).getTime()).toBe(86400_000)
  await page.getByRole("row").filter({ hasText: "HTTP_500" }).getByRole("button").first().click()
  await expect(page.getByTestId("ntf-detail")).toContainText("HTTP_500")
})

test("NTF-002 gửi lại thông báo lỗi qua xác nhận (có quyền MANAGE)", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["NOTIFICATION_LOG_VIEW", "NOTIFICATION_LOG_MANAGE"] })
  await mockApi(page, "/v1/notifications/deliveries", { method: "GET", body: pageOf([FAILED, SENT]) })
  const retry = await mockApi(page, "/v1/notifications/deliveries/7/retry", { method: "POST", body: ok({ ...FAILED, status: "SENT" }) })
  await page.goto("/notifications")
  await page.getByRole("button", { name: /Thao tác cho sales.invoice.posted · https/ }).click()
  await page.getByRole("menuitem", { name: "Gửi lại" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: /Gửi lại|Xác nhận/ }).click()
  await expect.poll(() => retry.length).toBe(1)
  // a SENT row offers no action at all
  await expect(page.getByRole("button", { name: /Thao tác cho sales.invoice.posted · a@/ })).toHaveCount(0)
})

test("NTF-003 Super Admin phải chọn công ty trước, sau đó gửi companyId", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/iam/companies", { body: pageOf([{ id: "3", name: "E2E Co" }]) })
  const list = await mockApi(page, "/v1/notifications/deliveries", { body: pageOf([SENT]) })
  await page.goto("/notifications")
  await expect(page.getByText("Chọn một công ty để xem nhật ký thông báo.")).toBeVisible()
  expect(list.length).toBe(0)
  await page.getByRole("combobox", { name: "Công ty" }).click()
  await page.getByRole("option", { name: "E2E Co" }).click()
  await expect(page.getByRole("row").filter({ hasText: "a@example.com" })).toBeVisible()
  expect(list.requests.at(-1)?.url.searchParams.get("companyId")).toBe("3")
})
