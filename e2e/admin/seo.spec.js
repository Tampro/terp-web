// @ts-check
/**
 * §3.7 SEO. Spec: iam-service SettingsController GET/PUT /v1/settings/admin/seo (metaKeywords, metaDescription,
 * metaImageUrl; full replacement), GET /v1/settings/public → seo + brand.titleText; custom pages carry metaTitle /
 * metaDescription (SiteService.PageDto). The /site tags are rendered on the server: see seo.int.spec.js.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const SEO = { metaKeywords: "erp, payroll", metaDescription: "E2E all-in-one ERP", metaImageUrl: "https://cdn.example.com/og.png" }

test("SEO-001 tab SEO: xem trước theo giá trị đang gõ, chặn ảnh không phải http(s) @smoke", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/seo", { method: "GET", body: ok(SEO) })
  const put = await mockApi(page, "/v1/settings/admin/seo", { method: "PUT", body: ok(SEO) })
  await page.goto("/settings?tab=seo")
  await expect(page.getByText("2 từ khóa")).toBeVisible()
  await page.getByLabel("Mô tả meta").fill("E2E new description")
  await expect(page.getByTestId("seo-search-preview")).toContainText("E2E new description")
  await expect(page.getByTestId("seo-share-preview").locator("img")).toHaveAttribute("src", SEO.metaImageUrl)
  await page.getByLabel("URL ảnh meta").fill("javascript:alert(1)")
  await expect(page.getByTestId("seo-share-preview").locator("img")).toHaveCount(0)
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(page.getByText("Nhập liên kết bắt đầu bằng http:// hoặc https://")).toBeVisible()
  expect(put.length).toBe(0)
  await page.getByLabel("URL ảnh meta").fill(SEO.metaImageUrl)
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ ...SEO, metaDescription: "E2E new description" })
})
