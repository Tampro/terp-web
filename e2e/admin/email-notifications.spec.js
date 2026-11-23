// @ts-check
/**
 * §3.7 Email notifications. Spec: iam-service SettingsController GET/PUT /v1/settings/admin/email-notifications
 * (PlatformEmailNotificationSettings: newUser, helpdeskTicketCreated, helpdeskTicketReply, helpdeskNotifyEmails ≤10;
 * full replacement; COMMON_001 for a bad address or more than 10).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const NOTIFY = { newUser: true, helpdeskTicketCreated: true, helpdeskTicketReply: true, helpdeskNotifyEmails: ["e2e.support@example.com"] }

test("MAILN-001 bật/tắt thông báo, thêm/xóa địa chỉ đội nền tảng; chặn email sai, trùng; gửi thay toàn bộ @smoke", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/email", { body: ok({ host: "smtp.example.com", port: 587, encryption: "TLS", passwordSet: false }) })
  await mockApi(page, "/v1/settings/admin/email-notifications", { method: "GET", body: ok(NOTIFY) })
  const put = await mockApi(page, "/v1/settings/admin/email-notifications", { method: "PUT", body: ok(NOTIFY) })
  await page.goto("/settings?tab=email")
  const card = page.locator("form").filter({ hasText: "Thông báo email" })
  await expect(card.getByTestId("notify-emails")).toContainText("e2e.support@example.com")
  await card.getByRole("switch", { name: "Người dùng mới" }).click()
  const input = card.getByLabel(/Địa chỉ của đội nền tảng/)
  await input.fill("not-an-email")
  await expect(card.getByText("Nhập địa chỉ email hợp lệ")).toBeVisible()
  await expect(card.getByRole("button", { name: "Thêm", exact: true })).toBeDisabled()
  await input.fill("E2E.SUPPORT@example.com")
  await expect(card.getByText("Địa chỉ này đã có trong danh sách")).toBeVisible()
  await input.fill("e2e.ops@example.com")
  await input.press("Enter")
  await expect(card.getByTestId("notify-emails")).toContainText("e2e.ops@example.com")
  await card.getByRole("button", { name: "Xóa e2e.support@example.com" }).click()
  await card.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ newUser: false, helpdeskTicketCreated: true, helpdeskTicketReply: true, helpdeskNotifyEmails: ["e2e.ops@example.com"] })
})

test("MAILN-002 tối đa 10 địa chỉ; bật thông báo hỗ trợ mà chưa có địa chỉ thì có nhắc", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/email", { body: ok({}) })
  const ten = Array.from({ length: 10 }, (_, i) => `e2e${i}@example.com`)
  await mockApi(page, "/v1/settings/admin/email-notifications", { body: ok({ ...NOTIFY, helpdeskNotifyEmails: ten }) })
  await page.goto("/settings?tab=email")
  const card = page.locator("form").filter({ hasText: "Thông báo email" })
  await card.getByLabel(/Địa chỉ của đội nền tảng \(10\/10\)/).fill("e2e10@example.com")
  await expect(card.getByText("Tối đa 10 địa chỉ")).toBeVisible()
  for (const e of ten) await card.getByRole("button", { name: `Xóa ${e}` }).click()
  await expect(card.getByText("Chưa có địa chỉ nào: email hỗ trợ sẽ không gửi tới ai.")).toBeVisible()
})
