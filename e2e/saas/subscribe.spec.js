// @ts-check
/**
 * Company › Plans & subscribing (manual §4.2).
 * Spec sources: SubscriptionController — GET /saas/plans, /saas/plan-modules, /saas/subscription; POST /saas/orders/quote
 * (OrderForm; SAAS_006 invalid coupon), POST /saas/orders (bank transfer → PENDING + bankTransfer.transferContent),
 * PUT /saas/orders/{id}/receipt {fileId} (PDF/JPG/PNG ≤5 MB from the media library), POST /saas/plans/{id}/trial,
 * POST /saas/plan-requests; permissions SAAS_SUBSCRIPTION_VIEW / SAAS_ORDER_CREATE.
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"
import { MODULES, ORDER_PENDING, PLANS, SAAS_PERMISSIONS, SUBSCRIPTION } from "./data.js"

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function openCompanyPlans(page, permissions = SAAS_PERMISSIONS) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/saas/plans", { method: "GET", body: ok(PLANS) })
  await mockApi(page, "/v1/saas/plan-modules", { body: ok(MODULES) })
  await mockApi(page, "/v1/saas/subscription", { body: ok(SUBSCRIPTION) })
  await page.goto("/plans")
  await expect(page.getByTestId("current-plan")).toHaveText("E2E Free")
}

/** @param {import('@playwright/test').Page} page */
const proCard = (page) => page.locator("[data-slot=card]").filter({ hasText: "E2E Pro" })

test("SUB-001 gói hiện tại, số người dùng, nút Đăng ký/Dùng thử theo quyền @smoke", async ({ page }) => {
  await openCompanyPlans(page)
  await expect(page.getByText("3 / ∞")).toBeVisible()
  await expect(proCard(page).getByRole("button", { name: "Đăng ký" })).toBeVisible()
  await expect(proCard(page).getByRole("button", { name: "Dùng thử 14 ngày" })).toBeVisible()
  // the current plan offers Renew, not Subscribe
  await expect(page.locator("[data-slot=card]").filter({ hasText: "E2E Free" }).getByRole("button", { name: "Gia hạn" })).toBeVisible()
})

test("SUB-002 không có SAAS_ORDER_CREATE → chỉ xem, không có nút mua", async ({ page }) => {
  await openCompanyPlans(page, ["SAAS_SUBSCRIPTION_VIEW"])
  await expect(page.getByRole("button", { name: "Đăng ký" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Dùng thử/ })).toHaveCount(0)
})

test("SUB-003 theo năm: gói không có giá năm thì không đăng ký được", async ({ page }) => {
  await openCompanyPlans(page)
  await page.getByRole("radio", { name: "Theo năm" }).click()
  await expect(page.locator("[data-slot=card]").filter({ hasText: "E2E Free" }).getByRole("button", { name: "Gia hạn" })).toBeDisabled()
  await expect(proCard(page).getByRole("button", { name: "Đăng ký" })).toBeEnabled()
})

test("SUB-004 đăng ký chuyển khoản: coupon sai giữ giá cũ, coupon đúng giảm giá, đặt đơn gửi coupon đã duyệt, hiện thông tin chuyển khoản, upload biên lai", async ({ page }) => {
  await openCompanyPlans(page)
  const quote = await mockApi(page, "/v1/saas/orders/quote", { body: ok({ originalPrice: 490000, discountAmount: 0, finalPrice: 490000 }) })
  await proCard(page).getByRole("button", { name: "Đăng ký" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByTestId("quote-final")).toHaveText("490.000")

  // invalid coupon: backend error shown, price kept
  await page.unroute(/\/api\/v1\/saas\/orders\/quote/)
  await mockApi(page, "/v1/saas/orders/quote", { status: 400, body: fail("SAAS_006", "Mã giảm giá không hợp lệ.") })
  await dialog.getByLabel("Mã giảm giá").fill("bad")
  await dialog.getByRole("button", { name: "Áp dụng" }).click()
  await expect(dialog.getByText("Mã giảm giá không hợp lệ.")).toBeVisible()
  await expect(dialog.getByTestId("quote-final")).toHaveText("490.000")

  // valid coupon
  await page.unroute(/\/api\/v1\/saas\/orders\/quote/)
  const quote2 = await mockApi(page, "/v1/saas/orders/quote", {
    body: ok({ originalPrice: 490000, discountAmount: 49000, finalPrice: 441000, couponCode: "E2E10" }),
  })
  await dialog.getByLabel("Mã giảm giá").fill("e2e10")
  await dialog.getByRole("button", { name: "Áp dụng" }).click()
  await expect(dialog.getByTestId("quote-final")).toHaveText("441.000")
  await expect(dialog.getByText("Đã áp dụng mã E2E10")).toBeVisible()
  expect(quote2[0]).toMatchObject({ planId: 2, billingCycle: "MONTHLY", couponCode: "E2E10" }) // upper-cased
  expect(quote[0]).toEqual({ planId: 2, billingCycle: "MONTHLY", paymentMethod: "BANK_TRANSFER" })

  const order = await mockApi(page, "/v1/saas/orders", { method: "POST", body: ok({ ...ORDER_PENDING, receiptFileId: null }) })
  await dialog.getByRole("button", { name: "Đặt hàng" }).click()
  await expect(dialog.getByTestId("transfer-content")).toHaveText("ORD-E2E-0071")
  await expect(dialog).toContainText("0123456789")
  expect(order).toEqual([{ planId: 2, billingCycle: "MONTHLY", couponCode: "E2E10", paymentMethod: "BANK_TRANSFER" }])

  // receipt: wrong type refused locally; PDF uploaded to media then attached by id
  const upload = await mockApi(page, "/v1/media/files", { method: "POST", body: ok([{ id: "901" }]) })
  const receipt = await mockApi(page, "/v1/saas/orders/71/receipt", { body: ok(ORDER_PENDING) })
  await page.getByTestId("receipt-input").setInputFiles({ name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") })
  await expect(page.getByText("Chỉ chấp nhận PDF, JPG hoặc PNG")).toBeVisible()
  expect(upload.requests).toHaveLength(0)
  await page.getByTestId("receipt-input").setInputFiles({ name: "bien-lai.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") })
  await expect(dialog.getByText("Đã đính kèm biên lai: bien-lai.pdf")).toBeVisible()
  expect(receipt).toEqual([{ fileId: 901 }])
})

test("SUB-005 dùng thử gói gọi POST /plans/{id}/trial và tải lại gói hiện tại", async ({ page }) => {
  await openCompanyPlans(page)
  const trial = await mockApi(page, "/v1/saas/plans/2/trial", { body: ok({ ...SUBSCRIPTION, status: "TRIAL", plan: PLANS[1] }) })
  await proCard(page).getByRole("button", { name: "Dùng thử 14 ngày" }).click()
  await expect(page.getByText("Đã bắt đầu dùng thử E2E Pro trong 14 ngày")).toBeVisible()
  expect(trial.requests).toHaveLength(1)
})

test("SUB-006 lỗi dùng thử (SAAS_035 đã dùng thử) → hiện message backend", async ({ page }) => {
  await openCompanyPlans(page)
  await mockApi(page, "/v1/saas/plans/2/trial", { status: 400, body: fail("SAAS_035", "Bạn đã dùng thử gói này.") })
  await proCard(page).getByRole("button", { name: "Dùng thử 14 ngày" }).click()
  await expect(page.getByText("Bạn đã dùng thử gói này.")).toBeVisible()
})

test("SUB-007 gửi yêu cầu cho quản trị thay vì thanh toán", async ({ page }) => {
  await openCompanyPlans(page)
  await mockApi(page, "/v1/saas/orders/quote", { body: ok({ originalPrice: 490000, discountAmount: 0, finalPrice: 490000 }) })
  const req = await mockApi(page, "/v1/saas/plan-requests", { method: "POST", body: ok({ id: "40" }) })
  await proCard(page).getByRole("button", { name: "Đăng ký" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Gửi yêu cầu cho quản trị" }).click()
  await expect(page.getByText("Đã gửi yêu cầu. Super Admin sẽ xem xét.")).toBeVisible()
  expect(req).toEqual([{ planId: 2, billingCycle: "MONTHLY" }])
})
