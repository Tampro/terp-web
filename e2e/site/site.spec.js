// @ts-check
/**
 * §3.4 public website CMS. Spec: iam-service SiteAdminController /v1/settings/admin/site (landing sections = JSON per key,
 * PUT full replacement; pages; inquiries; newsletter) and PublicSiteController /v1/public/site (no token). Section shapes
 * are this app's (lib/site/site.sections.ts).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const EMPTY = Object.fromEntries(["general", "order", "advanced", "header", "hero", "footer", "features", "screenshots", "whyUs", "about", "team", "reviews", "plans", "faq", "newsletter", "contact"].map((k) => [k, null]))

test("SITE-001 trang chủ: sửa banner, xem trước ngay, lưu đúng một mục (PUT /landing/hero) @smoke", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/site/landing", { body: ok(EMPTY) })
  await mockApi(page, "/v1/saas/admin/plans", { body: ok([]) })
  await mockApi(page, "/v1/settings/admin/site/pages", { body: pageOf([]) })
  const put = await mockApi(page, "/v1/settings/admin/site/landing/hero", { method: "PUT", body: ok({ title: "E2E Hero" }) })
  await page.goto("/website")
  await page.getByRole("button", { name: "Banner chính" }).click()
  await page.getByLabel("Tiêu đề").fill("E2E Hero <b>x</b>")
  await page.getByLabel("Liên kết nút thứ nhất").fill("javascript:alert(1)")
  await page.getByLabel("Chữ nút thứ nhất").fill("E2E Go")
  const preview = page.getByTestId("site-preview")
  await expect(preview.getByRole("heading", { name: "E2E Hero <b>x</b>" })).toBeVisible()
  // an unsafe link is not rendered as a link
  await expect(preview.getByRole("link", { name: "E2E Go" })).toHaveCount(0)
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ title: "E2E Hero <b>x</b>", primaryUrl: "javascript:alert(1)", primaryText: "E2E Go" })
})

test("SITE-002 thứ tự mục: ẩn và đổi chỗ khối, gửi {items} đủ 13 khối", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/site/landing", { body: ok(EMPTY) })
  await mockApi(page, "/v1/saas/admin/plans", { body: ok([]) })
  await mockApi(page, "/v1/settings/admin/site/pages", { body: pageOf([]) })
  const put = await mockApi(page, "/v1/settings/admin/site/landing/order", { method: "PUT", body: ok(null) })
  await page.goto("/website")
  await page.getByRole("button", { name: "Thứ tự mục" }).click()
  await page.getByRole("switch", { name: "Hiện Đội ngũ" }).click()
  await page.getByRole("button", { name: "Đưa Banner chính lên" }).click()
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  const items = /** @type {{key:string,enabled:boolean}[]} */ (put[0].items)
  expect(items).toHaveLength(13)
  expect(items.slice(0, 2).map((i) => i.key)).toEqual(["hero", "header"])
  expect(items.at(-1)?.key).toBe("footer")
  expect(items.find((i) => i.key === "team")?.enabled).toBe(false)
})

test("SITE-003 trang tùy chỉnh, liên hệ (trả lời, trạng thái) và bản tin", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/site/pages", { method: "GET", body: pageOf([{ id: "1", title: "E2E Terms", slug: "e2e-terms", preview: "x", published: true }]) })
  const create = await mockApi(page, "/v1/settings/admin/site/pages", { method: "POST", body: ok({ id: "2" }) })
  const INQ = { id: "5", name: "E2E Guest", email: "g@example.com", subject: "E2E Price", message: "E2E hello\nline 2", status: "NEW", createdDate: "2026-11-23T01:00:00Z" }
  await mockApi(page, "/v1/settings/admin/site/inquiries", { body: pageOf([INQ]) })
  const reply = await mockApi(page, "/v1/settings/admin/site/inquiries/5/reply", { method: "POST", body: ok(INQ) })
  await mockApi(page, "/v1/settings/admin/site/newsletter", { body: pageOf([{ id: "7", email: "n@example.com", subscribedDate: "2026-11-23T01:00:00Z" }]) })
  await page.goto("/website?tab=pages")
  await expect(page.getByRole("link", { name: /\/site\/e2e-terms/ })).toBeVisible()
  await page.getByRole("button", { name: "Thêm trang" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Tiêu đề *").fill("E2E Privacy")
  await dlg.getByLabel("Nội dung (HTML) *").fill("<p>E2E</p>")
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toMatchObject({ title: "E2E Privacy", content: "<p>E2E</p>", published: true })
  await page.getByRole("tab", { name: "Liên hệ" }).click()
  await page.getByRole("cell", { name: "E2E Guest", exact: true }).click()
  await expect(page.getByTestId("site-inquiry-message")).toHaveText("E2E hello\nline 2")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: /Thao tác cho E2E Guest/ }).click()
  await page.getByRole("menuitem", { name: "Gửi trả lời" }).click()
  const rd = page.getByRole("dialog")
  await expect(rd.getByLabel("Chủ đề *")).toHaveValue("Re: E2E Price")
  await rd.getByLabel("Nội dung *").fill("E2E answer")
  await rd.getByRole("button", { name: /Lưu thay đổi|Xác nhận|Gửi trả lời/ }).last().click()
  await expect.poll(() => reply.length).toBe(1)
  expect(reply[0]).toEqual({ subject: "Re: E2E Price", message: "E2E answer" })
  await page.getByRole("tab", { name: "Bản tin" }).click()
  await expect(page.getByRole("cell", { name: "n@example.com", exact: true })).toBeVisible()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Xuất CSV" }).click()
  expect((await download).suggestedFilename()).toBe("newsletter-subscribers.csv")
})

test("SITE-004 trang công khai /site: khối trống bị bỏ, gửi liên hệ và đăng ký bản tin không cần đăng nhập", async ({ page }) => {
  await mockApi(page, "/v1/public/site/landing", {
    body: ok({
      order: ["header", "hero", "features", "newsletter", "contact", "footer"],
      sections: { general: { companyName: "E2E Co" }, hero: { title: "E2E Welcome" }, footer: { copyright: "© E2E" } },
      plans: [],
      pages: [{ title: "E2E Terms", slug: "e2e-terms" }],
    }),
  })
  const contact = await mockApi(page, "/v1/public/site/contact", { method: "POST", body: ok(null) })
  const sub = await mockApi(page, "/v1/public/site/newsletter", { method: "POST", body: ok(null) })
  await page.goto("/site")
  await expect(page.getByRole("heading", { name: "E2E Welcome" })).toBeVisible()
  await expect(page.locator("#features")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "E2E Terms" }).first()).toHaveAttribute("href", "/site/e2e-terms")
  await page.getByLabel("Họ tên").fill("E2E Guest")
  await page.locator("#contact").getByLabel("Email").fill("g@example.com")
  await page.getByLabel("Chủ đề").fill("E2E Q")
  await page.getByLabel("Nội dung").fill("E2E msg")
  await page.getByRole("button", { name: "Gửi", exact: true }).click()
  await expect.poll(() => contact.length).toBe(1)
  expect(contact[0]).toEqual({ name: "E2E Guest", email: "g@example.com", subject: "E2E Q", message: "E2E msg" })
  await page.locator("#newsletter").getByLabel("Email").fill("n@example.com")
  await page.getByRole("button", { name: "Đăng ký" }).click()
  await expect.poll(() => sub.length).toBe(1)
  expect(sub[0]).toEqual({ email: "n@example.com" })
  await expect(page.locator("#newsletter").getByRole("status")).toHaveText("Cảm ơn bạn đã đăng ký.")
})
