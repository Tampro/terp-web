// @ts-check
/**
 * §3.7 Brand. Spec: iam-service SettingsController GET/PUT /v1/settings/admin/brand (BrandSettings: themeColor
 * blue|green|purple|orange|red|teal|#RRGGBB, companyMobile ^$|[0-9+()\-. ]{3,30}, …; full replacement) and
 * GET /v1/settings/public → brand; a company user gets GET /v1/settings/company/effective → brand. Brand values are
 * defaults: a colour theme picked in the Theme Customizer wins.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const BRAND = {
  logoDarkUrl: "https://cdn.example.com/logo-dark.png",
  logoLightUrl: "https://cdn.example.com/logo-light.png",
  faviconUrl: "https://cdn.example.com/favicon.png",
  titleText: "E2E Brand",
  footerText: "© E2E",
  themeColor: "#10b981",
  sidebarVariant: "FLOATING",
  sidebarStyle: "GRADIENT",
  layoutDirection: "RTL",
  themeMode: "LIGHT",
  companyMobile: "+84 28 1234 5678",
  companyAddress: "E2E Street 1",
}

test("BRAND-001 form: số điện thoại, địa chỉ; chặn màu, số điện thoại và ảnh sai; gửi đủ các trường @smoke", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/brand", { method: "GET", body: ok({ ...BRAND, companyMobile: null, companyAddress: null }) })
  const put = await mockApi(page, "/v1/settings/admin/brand", { method: "PUT", body: ok(BRAND) })
  await page.goto("/settings?tab=brand")
  await page.getByLabel("Số điện thoại công ty").fill("abc")
  await page.getByLabel("Màu chủ đạo").first().fill("pink")
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(page.getByText("Chỉ gồm chữ số và + ( ) - . , dài 3 đến 30 ký tự")).toBeVisible()
  await expect(page.getByText("Dùng blue, green, purple, orange, red, teal hoặc mã màu như #1e5eaf")).toBeVisible()
  expect(put.length).toBe(0)
  await page.getByLabel("Số điện thoại công ty").fill(BRAND.companyMobile)
  await page.getByLabel("Địa chỉ công ty").fill(BRAND.companyAddress)
  await page.getByLabel("Màu chủ đạo").first().fill("teal")
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ ...BRAND, themeColor: "teal" })
})

test("BRAND-002 áp dụng thương hiệu: logo, kiểu sidebar, màu chủ đạo, RTL, favicon, liên hệ ở chân trang, chế độ sáng", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/public", { body: ok({ brand: BRAND }) })
  await mockApi(page, "/v1/saas/admin/dashboard", { body: ok({}) })
  await page.goto("/dashboard")
  await expect(page.getByTestId("brand-logo")).toHaveAttribute("src", BRAND.logoLightUrl)
  const html = page.locator("html")
  await expect(html).toHaveAttribute("dir", "rtl")
  await expect(html).toHaveAttribute("data-sidebar-style", "gradient")
  await expect(html).toHaveClass(/\blight\b/)
  await expect(page.locator('[data-slot="sidebar"][data-variant="floating"]').first()).toBeAttached()
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("#10b981")
  await expect(page.locator('link[rel="icon"][data-brand]')).toHaveAttribute("href", BRAND.faviconUrl)
  await expect(page.getByTestId("brand-contact")).toHaveText("+84 28 1234 5678 · E2E Street 1")
  // remembered for the next page load's theme script
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("erp.brand") ?? "{}"))).toEqual({ mode: "light", color: "#10b981", dir: "rtl" })
})

test("BRAND-003 người dùng đã tự chọn giao diện thì giữ giao diện của họ; công ty dùng thương hiệu hiệu lực của mình", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ui-theme", JSON.stringify({ state: { theme: "gaussian-black", chosen: true }, version: 0 }))
  })
  await mockLoggedIn(page)
  await mockApi(page, "/v1/settings/public", { body: ok({ brand: BRAND }) })
  const effective = await mockApi(page, "/v1/settings/company/effective", { body: ok({ brand: { ...BRAND, titleText: "E2E Company Brand", logoDarkUrl: null, logoLightUrl: null, layoutDirection: "LTR" } }) })
  await page.goto("/profile")
  await expect(page.getByText("E2E Company Brand").first()).toBeVisible()
  expect(effective.length).toBeGreaterThan(0)
  const html = page.locator("html")
  await expect(html).toHaveClass(/gaussian-black/)
  await expect(html).toHaveAttribute("dir", "ltr")
  // a custom theme keeps its own palette: no brand colour on the root
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("")
})
