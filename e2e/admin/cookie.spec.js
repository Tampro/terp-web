// @ts-check
/**
 * §3.7 Cookie settings. Spec: iam-service SettingsController GET/PUT /v1/settings/admin/cookie (CookieSettings, full
 * replacement, contactUrl ^$|https?://.+), SiteAdminController GET /v1/settings/admin/site/cookie-consents/export?from&to
 * (CSV, ≤366 days SITE_007), PublicSiteController POST /v1/public/site/cookie-consent {choice, categories}.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const COOKIE = {
  enableLogging: false,
  cookieTitle: "Cookie Consent",
  cookieDescription: null,
  strictlyTitle: "Strictly Necessary Cookies",
  strictlyDescription: "Essential.",
  contactDescription: null,
  contactUrl: null,
}

test("CK-001 lưu cài đặt cookie (thay toàn bộ), chặn liên kết không phải http(s) @smoke", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/cookie", { method: "GET", body: ok(COOKIE) })
  const put = await mockApi(page, "/v1/settings/admin/cookie", { method: "PUT", body: ok(COOKIE) })
  await page.goto("/settings?tab=cookie")
  await page.getByRole("switch", { name: "Bật ghi nhận" }).click()
  await page.getByLabel("Mô tả cookie", { exact: true }).fill("E2E we use cookies")
  await page.getByLabel("Liên kết liên hệ").fill("javascript:alert(1)")
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(page.getByText("Nhập liên kết bắt đầu bằng http:// hoặc https://")).toBeVisible()
  expect(put.length).toBe(0)
  await page.getByLabel("Liên kết liên hệ").fill("https://example.com/contact")
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ ...COOKIE, enableLogging: true, cookieDescription: "E2E we use cookies", contactUrl: "https://example.com/contact" })
})

test("CK-002 tải CSV đồng ý theo khoảng ngày; chặn khoảng ngược và quá 366 ngày", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/cookie", { body: ok(COOKIE) })
  const csv = await mockApi(page, "/v1/settings/admin/site/cookie-consents/export", { body: "consented_at,choice\n" })
  await page.goto("/settings?tab=cookie")
  const btn = page.getByRole("button", { name: "Tải CSV" })
  await page.getByLabel("Từ ngày").fill("2026-11-20")
  await page.getByLabel("Đến ngày").fill("2026-11-10")
  await expect(btn).toBeDisabled()
  await page.getByLabel("Từ ngày").fill("2025-01-01")
  await page.getByLabel("Đến ngày").fill("2026-11-10")
  await expect(page.getByText("Chọn tối đa 366 ngày")).toBeVisible()
  await page.getByLabel("Từ ngày").fill("2026-11-01")
  const download = page.waitForEvent("download")
  await btn.click()
  expect((await download).suggestedFilename()).toBe("cookie-consents-2026-11-01_2026-11-10.csv")
  expect(csv.requests[0].url.searchParams.get("from")).toBe("2026-11-01")
  expect(csv.requests[0].url.searchParams.get("to")).toBe("2026-11-10")
})

test("CK-003 banner trên /site: tùy chỉnh gửi CUSTOM + nhóm đã chọn, lần sau không hiện lại", async ({ page }) => {
  await mockApi(page, "/v1/settings/public", { body: ok({ cookie: { ...COOKIE, cookieTitle: "E2E Cookies", cookieDescription: "E2E text", contactUrl: "javascript:x", contactDescription: "Questions?" } }) })
  await mockApi(page, "/v1/public/site/landing", { body: ok({ order: ["hero"], sections: { hero: { title: "E2E Home" } }, plans: [], pages: [] }) })
  const consent = await mockApi(page, "/v1/public/site/cookie-consent", { method: "POST", body: ok({ recorded: true }) })
  await page.goto("/site")
  const banner = page.getByRole("dialog", { name: "E2E Cookies" })
  await expect(banner).toContainText("E2E text")
  // an unsafe contact link is not rendered
  await expect(banner.getByRole("link")).toHaveCount(0)
  await banner.getByRole("button", { name: "Tùy chỉnh" }).click()
  await expect(banner.getByRole("checkbox", { name: "Strictly Necessary Cookies" })).toBeDisabled()
  await banner.getByRole("checkbox", { name: "Phân tích" }).click()
  await banner.getByRole("button", { name: "Lưu lựa chọn" }).click()
  await expect.poll(() => consent.length).toBe(1)
  expect(consent[0]).toEqual({ choice: "CUSTOM", categories: ["analytics"] })
  await expect(banner).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole("heading", { name: "E2E Home" })).toBeVisible()
  await expect(page.getByRole("dialog", { name: "E2E Cookies" })).toHaveCount(0)
})
