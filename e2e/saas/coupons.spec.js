// @ts-check
/**
 * Super Admin › Coupons (manual §4.4).
 * Spec sources: CouponController GET /saas/admin/coupons (keyword, type, active) + /status-counts, GET /{id}
 * (coupon + usageHistory), POST (CouponForm; AUTO = 8-char generated code, MANUAL needs code; SAAS_012 % > 100,
 * SAAS_020 min > max), PUT /{id} (full replacement), PUT /{id}/status {enabled}, DELETE /{id} (soft).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { COUPONS } from "./data.js"

/** @param {import('@playwright/test').Page} page */
async function openCoupons(page) {
  await mockLoggedIn(page, { superAdmin: true })
  const list = await mockApi(page, "/v1/saas/admin/coupons", { method: "GET", body: pageOf(COUPONS) })
  await mockApi(page, "/v1/saas/admin/coupons/status-counts", { body: ok({ all: 1, active: 1, inactive: 0 }) })
  await page.goto("/coupons")
  await expect(page.getByText("E2E10", { exact: true })).toBeVisible()
  return { list }
}

test("CPN-001 danh sách: giảm %, đã dùng / giới hạn, không hết hạn; lọc loại gửi type @smoke", async ({ page }) => {
  const { list } = await openCoupons(page)
  const row = page.getByRole("row").filter({ hasText: "E2E10" })
  await expect(row).toContainText("10%")
  await expect(row).toContainText("1 / 100")
  await expect(row).toContainText("Không hết hạn")
  await page.getByRole("combobox", { name: "Loại" }).click()
  await page.getByRole("option", { name: "Số tiền cố định" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("type")).toBe("FLAT")
})

test("CPN-002 tạo mã: kiểm tra % > 100, min > max, mã bắt buộc khi nhập tay; Tự sinh không gửi code", async ({ page }) => {
  await openCoupons(page)
  const create = await mockApi(page, "/v1/saas/admin/coupons", { method: "POST", body: ok({ id: "6", code: "AB12CD34" }) })
  await page.getByRole("button", { name: "Tạo mã giảm giá" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên").fill("E2E Black Friday")
  await dialog.getByLabel("Giảm (%)").fill("101")
  await dialog.getByLabel("Chi tiêu tối thiểu").fill("500000")
  await dialog.getByLabel("Chi tiêu tối đa").fill("100000")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog.getByText("Phần trăm không được vượt quá 100")).toBeVisible()
  await expect(dialog.getByText("Chi tiêu tối đa phải ≥ tối thiểu")).toBeVisible()
  await expect(dialog.getByText("Trường này là bắt buộc")).toBeVisible() // manual code empty
  expect(create).toHaveLength(0)

  await dialog.getByLabel("Giảm (%)").fill("20")
  await dialog.getByLabel("Chi tiêu tối đa").fill("")
  await dialog.getByRole("radio", { name: "Tự sinh" }).click()
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog).toBeHidden()
  expect(create).toEqual([
    {
      name: "E2E Black Friday",
      type: "PERCENTAGE",
      discountValue: 20,
      codeGeneration: "AUTO",
      minimumSpend: 500000,
      maximumSpend: null,
      useLimitTotal: null,
      useLimitPerCompany: null,
      expiryDate: null,
      enabled: true,
      description: null,
    },
  ])
})

test("CPN-003 mã trùng (SAAS_005) → toast lỗi, form vẫn mở", async ({ page }) => {
  await openCoupons(page)
  await mockApi(page, "/v1/saas/admin/coupons", { method: "POST", status: 400, body: fail("SAAS_005", "Mã đã tồn tại.") })
  await page.getByRole("button", { name: "Tạo mã giảm giá" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên").fill("Dup")
  await dialog.getByLabel("Giảm (%)").fill("5")
  await dialog.getByLabel("Mã", { exact: true }).fill("e2e10")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(page.getByText("Mã đã tồn tại.")).toBeVisible()
  await expect(dialog).toBeVisible()
})

test("CPN-004 lịch sử sử dụng; ngừng mã gửi enabled=false", async ({ page }) => {
  await openCoupons(page)
  await mockApi(page, "/v1/saas/admin/coupons/5", {
    method: "GET",
    body: ok({
      coupon: COUPONS[0],
      usageHistory: [
        { orderId: "71", orderNumber: "ORD-E2E-0071", companyName: "E2E Acme Co., Ltd", discountApplied: 49000, finalPrice: 441000, status: "PENDING", usedAt: "2026-11-20T03:00:00Z" },
      ],
    }),
  })
  const status = await mockApi(page, "/v1/saas/admin/coupons/5/status", { body: ok({}) })

  await page.getByRole("button", { name: "Thao tác cho mã E2E10" }).click()
  await page.getByRole("menuitem", { name: "Lịch sử sử dụng" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("row").filter({ hasText: "ORD-E2E-0071" })).toContainText("49.000")
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Thao tác cho mã E2E10" }).click()
  await page.getByRole("menuitem", { name: "Ngừng hoạt động" }).click()
  await expect.poll(() => status.length).toBe(1)
  expect(status[0]).toEqual({ enabled: false })
})
