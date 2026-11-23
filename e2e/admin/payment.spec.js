// @ts-check
/**
 * §3.7 Payment settings. Spec: iam-service SettingsController /v1/settings/admin/payment/bank-transfer (BankTransferSettings,
 * full replacement) and /payment/stripe (StripeSettingsForm: secretKey / webhookSecret write-only, omitted = keep,
 * "" = remove; SETTINGS_010 enabled without all keys, SETTINGS_011 keys not of the mode).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const BANK = { enabled: true, bankName: null, accountNumber: null, accountName: null, details: null }
const STRIPE = { enabled: false, mode: "TEST", publishableKey: null, secretKeySet: false, webhookSecretSet: false }

/** @param {import('@playwright/test').Page} page */
async function open(page, stripe = STRIPE) {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/payment/bank-transfer", { method: "GET", body: ok(BANK) })
  await mockApi(page, "/v1/settings/admin/payment/stripe", { method: "GET", body: ok(stripe) })
  await page.goto("/settings?tab=payment")
}
const stripeCard = (/** @type {import('@playwright/test').Page} */ page) => page.locator("form").filter({ hasText: "Stripe Checkout" })

test("PAY-001 chuyển khoản: lưu thông tin tài khoản (thay toàn bộ) @smoke", async ({ page }) => {
  await open(page)
  const put = await mockApi(page, "/v1/settings/admin/payment/bank-transfer", { method: "PUT", body: ok(BANK) })
  await page.getByLabel("Tên ngân hàng").fill("E2E Bank")
  await page.getByLabel("Số tài khoản").fill("0123456789")
  await page.getByLabel("Chủ tài khoản").fill("E2E CO")
  await page.locator("form").filter({ hasText: "Chủ tài khoản" }).getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ enabled: true, bankName: "E2E Bank", accountNumber: "0123456789", accountName: "E2E CO", details: null })
})

test("PAY-002 Stripe: bật khi thiếu khóa bị chặn, khóa sai chế độ bị chặn, khóa đúng thì gửi", async ({ page }) => {
  await open(page)
  const put = await mockApi(page, "/v1/settings/admin/payment/stripe", { method: "PUT", body: ok({ ...STRIPE, enabled: true, publishableKey: "pk_test_abc", secretKeySet: true, webhookSecretSet: true }) })
  const card = stripeCard(page)
  await card.getByRole("switch", { name: "Cho phép thanh toán Stripe khi mua gói" }).click()
  await expect(card.getByText("Để bật Stripe, cần nhập")).toBeVisible()
  await card.getByRole("button", { name: "Lưu thay đổi" }).click()
  expect(put.length).toBe(0)
  await card.getByLabel("Publishable key").fill("pk_live_abc")
  await expect(card.getByText("Khóa này không thuộc chế độ đã chọn")).toBeVisible()
  await card.getByLabel("Publishable key").fill("pk_test_abc")
  await card.getByLabel("Secret key", { exact: true }).fill("sk_test_123")
  await card.getByLabel("Webhook signing secret", { exact: true }).fill("bad")
  await expect(card.getByText("Webhook signing secret bắt đầu bằng whsec_")).toBeVisible()
  await card.getByLabel("Webhook signing secret", { exact: true }).fill("whsec_456")
  await card.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ enabled: true, mode: "TEST", publishableKey: "pk_test_abc", secretKey: "sk_test_123", webhookSecret: "whsec_456" })
  await expect(card.getByTestId("stripe-webhook-path")).toHaveText("/api/v1/public/payments/stripe/webhook")
})

test("PAY-003 Stripe: khóa đã lưu được giữ (không gửi), tick xóa thì gửi chuỗi rỗng", async ({ page }) => {
  await open(page, { enabled: false, mode: "TEST", publishableKey: "pk_test_abc", secretKeySet: true, webhookSecretSet: true })
  const put = await mockApi(page, "/v1/settings/admin/payment/stripe", { method: "PUT", body: ok(STRIPE) })
  const card = stripeCard(page)
  await expect(card.getByText("A value is stored").or(card.getByText("Đã lưu một giá trị")).first()).toBeVisible()
  await card.getByRole("checkbox", { name: "Xóa Webhook signing secret đã lưu" }).click()
  await card.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ enabled: false, mode: "TEST", publishableKey: "pk_test_abc", webhookSecret: "" })
})

test("PAY-004 Stripe: đổi chế độ khi giữ secret key đã lưu thì phải nhập lại", async ({ page }) => {
  await open(page, { enabled: false, mode: "TEST", publishableKey: "pk_test_abc", secretKeySet: true, webhookSecretSet: true })
  const put = await mockApi(page, "/v1/settings/admin/payment/stripe", { method: "PUT", body: ok(STRIPE) })
  const card = stripeCard(page)
  await card.getByRole("combobox", { name: "Chế độ" }).click()
  await page.getByRole("option", { name: "Thật" }).click()
  await card.getByLabel("Publishable key").fill("pk_live_abc")
  await expect(card.getByText("Đã đổi chế độ: nhập secret key của chế độ này")).toBeVisible()
  await card.getByRole("button", { name: "Lưu thay đổi" }).click()
  expect(put.length).toBe(0)
  await card.getByLabel("Secret key", { exact: true }).fill("sk_live_123")
  await card.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ enabled: false, mode: "LIVE", publishableKey: "pk_live_abc", secretKey: "sk_live_123" })
})
