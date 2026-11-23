// @ts-check
/**
 * Referral program. Spec: iam-service ReferralController — super admin /v1/saas/admin/referral/{settings,dashboard,
 * referred,referred/summary,payouts,payouts/status-counts,payouts/{id}/approve|reject}; company /v1/saas/referral
 * (SAAS_ORDER_VIEW) + /payouts (POST needs SAAS_ORDER_CREATE; SAAS_027 below threshold, SAAS_028 above balance,
 * SAAS_029 pending exists, SAAS_032 program off).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const MINE = { referralCode: "REFE2E01", programEnabled: true, commissionPercentage: 10, thresholdAmount: 500000, guidelines: "E2E <b>rules</b>\nline 2", referredCompanies: 2, totalEarned: 900000, paidOut: 0, pendingPayout: 0, availableBalance: 900000 }
const PAYOUT = { id: "7", companyName: "E2E Referrer", companyEmail: "ref@example.com", amount: 600000, status: "PENDING", createdDate: "2026-11-23T01:00:00Z" }

test("REF-001 công ty: mã giới thiệu, số dư, hướng dẫn dạng chữ; rút tiền kiểm tối thiểu / tối đa @smoke", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["SAAS_ORDER_VIEW", "SAAS_ORDER_CREATE"] })
  await mockApi(page, "/v1/saas/referral", { body: ok(MINE) })
  await mockApi(page, "/v1/saas/referral/payouts", { method: "GET", body: pageOf([]) })
  const post = await mockApi(page, "/v1/saas/referral/payouts", { method: "POST", body: ok(PAYOUT) })
  await page.goto("/referral")
  await expect(page.getByTestId("ref-code")).toHaveText("REFE2E01")
  await expect(page.getByTestId("ref-guidelines")).toHaveText("E2E <b>rules</b>\nline 2")
  await page.getByRole("button", { name: "Yêu cầu rút tiền" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Số tiền").fill("100000")
  await expect(dlg.getByText(/Tối thiểu 500\.000/)).toBeVisible()
  await dlg.getByLabel("Số tiền").fill("1000000")
  await expect(dlg.getByText(/Tối đa 900\.000/)).toBeVisible()
  await dlg.getByRole("button", { name: "Tất cả" }).click()
  await dlg.getByRole("button", { name: "Gửi yêu cầu" }).click()
  await expect.poll(() => post.length).toBe(1)
  expect(post[0]).toEqual({ amount: 900000 })
})

test("REF-002 công ty: đang có yêu cầu chờ thì không gửi thêm; chương trình tắt thì không có nút rút", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["SAAS_ORDER_VIEW", "SAAS_ORDER_CREATE"] })
  await mockApi(page, "/v1/saas/referral", { body: ok({ ...MINE, pendingPayout: 600000, availableBalance: 300000 }) })
  await mockApi(page, "/v1/saas/referral/payouts", { body: pageOf([PAYOUT]) })
  await page.goto("/referral")
  await page.getByRole("button", { name: "Yêu cầu rút tiền" }).click()
  await expect(page.getByRole("dialog").getByText("Đang có một yêu cầu chờ xử lý")).toBeVisible()
  await expect(page.getByRole("dialog").getByRole("button", { name: "Gửi yêu cầu" })).toBeDisabled()

  await mockApi(page, "/v1/saas/referral", { body: ok({ ...MINE, programEnabled: false }) })
  await page.goto("/referral")
  await expect(page.getByText(/Chương trình giới thiệu đang tắt/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Yêu cầu rút tiền" })).toHaveCount(0)
})

test("REF-003 Super Admin: duyệt yêu cầu rút tiền qua xác nhận; lưu cài đặt (0..100%)", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/saas/admin/referral/payouts", { body: pageOf([PAYOUT]) })
  const approve = await mockApi(page, "/v1/saas/admin/referral/payouts/7/approve", { method: "POST", body: ok({ ...PAYOUT, status: "APPROVED" }) })
  await mockApi(page, "/v1/saas/admin/referral/settings", { method: "GET", body: ok({ enabled: true, commissionPercentage: 10, thresholdAmount: 500000, guidelines: null }) })
  const save = await mockApi(page, "/v1/saas/admin/referral/settings", { method: "PUT", body: ok({}) })
  await page.goto("/referral?tab=payouts")
  await page.getByRole("button", { name: /Thao tác cho E2E Referrer/ }).click()
  await page.getByRole("menuitem", { name: "Duyệt (đã chi trả)" }).click()
  await page.getByRole("alertdialog").getByRole("button").last().click()
  await expect.poll(() => approve.length).toBe(1)
  await page.getByRole("tab", { name: "Cài đặt chương trình" }).click()
  await page.getByLabel("Hoa hồng (%)").fill("150")
  await expect(page.getByText("Từ 0 đến 100")).toBeVisible()
  await page.getByLabel("Hoa hồng (%)").fill("12.5")
  await page.getByLabel("Hướng dẫn").fill("E2E Earn more")
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ enabled: true, commissionPercentage: 12.5, thresholdAmount: 500000, guidelines: "E2E Earn more" })
})

test("REF-004 Super Admin: tổng quan và lịch sử hoa hồng của công ty được giới thiệu", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/saas/admin/referral/dashboard", { body: ok({ totalReferredCompanies: 3, pendingPayouts: 600000, topReferrers: [{ companyId: "1", companyName: "E2E Referrer", referrals: 3, commissionEarned: 900000 }] }) })
  await mockApi(page, "/v1/saas/admin/referral/referred/summary", { body: ok({ totalReferred: 3, withPlans: 2, totalCommission: 900000 }) })
  await mockApi(page, "/v1/saas/admin/referral/referred", { body: pageOf([{ companyId: "5", companyName: "E2E Newcomer", referrerName: "E2E Referrer", planName: "Pro", planMonthlyPrice: 990000, commission: 99000, commissionHistory: [{ orderId: "o1", orderAmount: 990000, commissionPercentage: 10, amount: 99000, createdDate: "2026-11-20T00:00:00Z" }] }]) })
  await page.goto("/referral")
  await expect(page.getByTestId("ref-total-referred")).toHaveText("3")
  await expect(page.getByRole("row").filter({ hasText: "E2E Referrer" })).toContainText("900.000")
  await page.getByRole("tab", { name: "Công ty được giới thiệu" }).click()
  await page.getByRole("button", { name: "E2E Newcomer" }).click()
  await expect(page.getByTestId("ref-history")).toContainText("99.000")
})

test("REF-005 công ty: đường dẫn đăng ký có sẵn mã giới thiệu", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["SAAS_ORDER_VIEW"] })
  await mockApi(page, "/v1/saas/referral", { body: ok(MINE) })
  await mockApi(page, "/v1/saas/referral/payouts", { body: pageOf([]) })
  await page.goto("/referral")
  await expect(page.getByTestId("ref-link")).toHaveText(/\/register\?ref=REFE2E01$/)
})
