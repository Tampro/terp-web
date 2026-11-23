// @ts-check
/**
 * Super Admin › Platform settings (manual §3.7).
 * Spec sources: SettingsController /settings/admin/{brand,system,currency,seo,email,recaptcha,storage} — each PUT is a
 * full replacement; EmailSettingsForm.password and RecaptchaSettingsForm.secret are write-only ("omitted = keep");
 * CurrencyFormatSettings (separators, decimals, symbol position, space).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const BRAND = {
  logoDarkUrl: null,
  logoLightUrl: null,
  faviconUrl: null,
  titleText: "ERP",
  footerText: null,
  themeColor: "blue",
  sidebarVariant: "INSET",
  sidebarStyle: "PLAIN",
  layoutDirection: "LTR",
  themeMode: "LIGHT",
  companyMobile: null,
  companyAddress: null,
}

test.beforeEach(async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
})

test("SET-001 Thương hiệu: lưu gửi toàn bộ khối với giá trị mới @smoke", async ({ page }) => {
  await mockApi(page, "/v1/settings/admin/brand", { method: "GET", body: ok(BRAND) })
  const save = await mockApi(page, "/v1/settings/admin/brand", { method: "PUT", body: ok(BRAND) })
  await page.goto("/settings")
  await expect(page.getByLabel("Tiêu đề")).toHaveValue("ERP")
  await page.getByLabel("Tiêu đề").fill("E2E ERP")
  await page.getByLabel("Chân trang").fill("© 2026 E2E")
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(page.getByText("Đã lưu")).toBeVisible()
  expect(save).toEqual([{ ...BRAND, titleText: "E2E ERP", footerText: "© 2026 E2E" }])
})

test("SET-002 tab nằm trên URL (?tab=) và giữ khi tải lại", async ({ page }) => {
  await mockApi(page, "/v1/settings/admin/brand", { method: "GET", body: ok(BRAND) })
  await mockApi(page, "/v1/settings/admin/seo", { method: "GET", body: ok({ metaKeywords: "erp", metaDescription: null, metaImageUrl: null }) })
  await page.goto("/settings")
  await page.getByRole("tab", { name: "SEO" }).click()
  await expect(page).toHaveURL(/\?tab=seo$/)
  await page.reload()
  await expect(page.getByLabel("Từ khóa meta")).toHaveValue("erp")
})

test("SET-003 Email: mật khẩu để trống → không gửi password (giữ giá trị cũ); có nhập → gửi", async ({ page }) => {
  const view = { host: "smtp.example.com", port: 587, username: "mailer", passwordSet: true, encryption: "TLS", fromAddress: "noreply@example.com", fromName: "ERP" }
  await mockApi(page, "/v1/settings/admin/email", { method: "GET", body: ok(view) })
  const save = await mockApi(page, "/v1/settings/admin/email", { method: "PUT", body: ok(view) })
  await page.goto("/settings?tab=email")
  await expect(page.getByText("Đã lưu một giá trị; để trống để giữ nguyên")).toBeVisible()

  await page.getByRole("button", { name: "Lưu thay đổi" }).first().click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ host: "smtp.example.com", port: 587, username: "mailer", encryption: "TLS", fromAddress: "noreply@example.com", fromName: "ERP" })

  await page.getByLabel("Mật khẩu SMTP").fill("e2e-smtp-secret")
  await page.getByRole("button", { name: "Lưu thay đổi" }).first().click()
  await expect.poll(() => save.length).toBe(2)
  expect(save[1]).toMatchObject({ password: "e2e-smtp-secret" })
})

test("SET-004 Email: gửi email thử tới địa chỉ đã nhập", async ({ page }) => {
  await mockApi(page, "/v1/settings/admin/email", { method: "GET", body: ok({ host: "smtp.example.com", port: 587, encryption: "TLS", fromAddress: "noreply@example.com" }) })
  const test1 = await mockApi(page, "/v1/settings/admin/email/test", { body: ok(null) })
  await page.goto("/settings?tab=email")
  await page.getByLabel("Gửi email thử tới").fill("e2e.tester@example.com")
  await page.getByRole("button", { name: "Gửi email thử" }).click()
  await expect(page.getByText("Đã gửi email thử tới e2e.tester@example.com")).toBeVisible()
  expect(test1).toEqual([{ to: "e2e.tester@example.com" }])
})

test("SET-005 Tiền tệ: xem trước theo định dạng; chỉ gửi các trường định dạng", async ({ page }) => {
  const view = {
    format: { decimalPlaces: 0, symbolPosition: "AFTER", decimalSeparator: "COMMA", thousandsSeparator: "DOT", showDecimals: false, addSpace: true },
    defaultCurrencyCode: "VND",
    defaultCurrencySymbol: "₫",
  }
  await mockApi(page, "/v1/settings/admin/currency", { method: "GET", body: ok(view) })
  const save = await mockApi(page, "/v1/settings/admin/currency", { method: "PUT", body: ok(view) })
  await page.goto("/settings?tab=currency")
  await expect(page.getByTestId("currency-preview")).toHaveText("1.234.568 ₫")

  await page.getByRole("switch", { name: "Hiện phần thập phân" }).click()
  await page.getByRole("combobox", { name: "Số chữ số thập phân" }).click()
  await page.getByRole("option", { name: "2", exact: true }).click()
  await expect(page.getByTestId("currency-preview")).toHaveText("1.234.567,89 ₫")

  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ ...view.format, showDecimals: true, decimalPlaces: 2 }) // no code/symbol in the body
})

test("SET-006 Lưu trữ: bỏ hết loại tệp thì báo, chọn lại thì gửi danh sách", async ({ page }) => {
  await mockApi(page, "/v1/settings/admin/storage", { method: "GET", body: ok({ allowedFileTypes: ["png"], maxUploadSizeKb: 10240 }) })
  const save = await mockApi(page, "/v1/settings/admin/storage", { method: "PUT", body: ok({}) })
  await page.goto("/settings?tab=storage")
  await page.getByRole("button", { name: ".png", exact: true }).click()
  await expect(page.getByText("Chọn ít nhất một loại")).toBeVisible()
  await page.getByRole("button", { name: ".pdf", exact: true }).click()
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ allowedFileTypes: ["pdf"], maxUploadSizeKb: 10240 })
})
