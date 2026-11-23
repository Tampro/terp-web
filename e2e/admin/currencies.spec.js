// @ts-check
/**
 * §3.7 Currency page. Spec: iam-service SaasCurrencyController /v1/saas/admin/currencies (list, POST / PUT CurrencyForm
 * {code [A-Z]{3}, name, symbol?, description?, defaultCurrency}, DELETE; SAAS_024 delete default, SAAS_025 un-default).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const VND = { id: "1", code: "VND", name: "Vietnamese Dong", symbol: "₫", description: "Default", defaultCurrency: true }
const USD = { id: "2", code: "USD", name: "US Dollar", symbol: "$", description: null, defaultCurrency: false }

/** @param {import('@playwright/test').Page} page */
async function open(page) {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/currency", { method: "GET", body: ok({ format: { decimalPlaces: 0 }, defaultCurrencyCode: "VND", defaultCurrencySymbol: "₫" }) })
  const list = await mockApi(page, "/v1/saas/admin/currencies", { method: "GET", body: pageOf([VND, USD]) })
  await page.goto("/settings?tab=currency")
  await expect(page.getByRole("row").filter({ hasText: "VND" })).toContainText("Mặc định")
  return list
}

test("CUR-001 danh sách: tiền mặc định không xóa được; thêm tiền gửi CurrencyForm, chặn mã sai @smoke", async ({ page }) => {
  await open(page)
  const create = await mockApi(page, "/v1/saas/admin/currencies", { method: "POST", body: ok({ id: "3" }) })
  await page.getByRole("button", { name: /Thao tác cho VND/ }).click()
  await expect(page.getByRole("menuitem", { name: "Xóa" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Đặt làm mặc định" })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Thêm tiền tệ" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Mã *").fill("eur")
  await dlg.getByLabel("Tên *").fill("E2E Euro")
  await dlg.getByLabel("Ký hiệu").fill("€")
  await expect(dlg.getByText("3 chữ in hoa (ISO 4217), ví dụ USD")).toBeVisible()
  await expect(dlg.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
  expect(create.length).toBe(0)
  await dlg.getByLabel("Mã *").fill("EUR")
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ code: "EUR", name: "E2E Euro", symbol: "€", defaultCurrency: false })
})

test("CUR-002 đặt USD làm mặc định gửi PUT đầy đủ với defaultCurrency=true; sửa tiền mặc định vẫn giữ mặc định", async ({ page }) => {
  await open(page)
  const putUsd = await mockApi(page, "/v1/saas/admin/currencies/2", { method: "PUT", body: ok({ ...USD, defaultCurrency: true }) })
  const putVnd = await mockApi(page, "/v1/saas/admin/currencies/1", { method: "PUT", body: ok(VND) })
  await page.getByRole("button", { name: /Thao tác cho USD/ }).click()
  await page.getByRole("menuitem", { name: "Đặt làm mặc định" }).click()
  await page.getByRole("alertdialog").getByRole("button").last().click()
  await expect.poll(() => putUsd.length).toBe(1)
  expect(putUsd[0]).toEqual({ code: "USD", name: "US Dollar", symbol: "$", defaultCurrency: true })
  await page.getByRole("button", { name: /Thao tác cho VND/ }).click()
  await page.getByRole("menuitem", { name: "Sửa" }).click()
  const dlg = page.getByRole("dialog")
  await expect(dlg.getByRole("switch", { name: "Đặt làm tiền mặc định" })).toHaveCount(0)
  await dlg.getByLabel("Tên *").fill("E2E Dong")
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => putVnd.length).toBe(1)
  expect(putVnd[0]).toEqual({ code: "VND", name: "E2E Dong", symbol: "₫", description: "Default", defaultCurrency: true })
})
