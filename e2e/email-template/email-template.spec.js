// @ts-check
/**
 * §3.5 email templates. Spec: iam-service EmailTemplateController /v1/settings/admin/email-templates (super admin): list,
 * GET /{id}, PUT /{id}/settings {fromName}, PUT /{id}/content/{lang} {subject, content}, GET /{id}/preview/{lang}.
 * Edit only: no create or delete.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ROW = { id: "1", code: "USER_CREATE", name: "User Create", fromName: "{app_name}", createdDate: "2026-11-21T09:00:00Z" }
const DETAIL = {
  template: ROW,
  contents: [{ lang: "en", subject: "Welcome {user_name}", content: "<p>Hello {user_name}</p>" }],
  variables: ["user_name", "username"],
  toggleableByCompany: false,
}

test("ET-001 danh sách: không có nút tạo, bấm dòng mở trang sửa @smoke", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  const list = await mockApi(page, "/v1/settings/admin/email-templates", { body: pageOf([ROW]) })
  await mockApi(page, "/v1/settings/admin/email-templates/1", { body: ok(DETAIL) })
  await page.goto("/email-templates")
  await expect(page.getByRole("button", { name: /Thêm|Tạo/ })).toHaveCount(0)
  await page.getByRole("button", { name: "User Create", exact: true }).click()
  await expect(page).toHaveURL(/\/email-templates\/1$/)
  await expect(page.getByLabel("Tên người gửi")).toHaveValue("{app_name}")
  expect(list.length).toBeGreaterThan(0)
})

test("ET-002 sửa tiêu đề tiếng Việt (chưa có), chèn biến tại con trỏ, lưu đúng ngôn ngữ", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/email-templates/1", { method: "GET", body: ok(DETAIL) })
  const put = await mockApi(page, "/v1/settings/admin/email-templates/1/content/vi", { method: "PUT", body: ok({ ...DETAIL, contents: [...DETAIL.contents, { lang: "vi", subject: "Chào {user_name}", content: "<p>Xin chào</p>" }] }) })
  await page.goto("/email-templates/1")
  await expect(page.getByText("Ngôn ngữ này chưa có nội dung")).toBeVisible()
  await expect(page.getByRole("button", { name: "Xem trước" })).toBeDisabled()
  // required check before sending
  await page.getByLabel("Tiêu đề email *").fill("Chào ")
  await page.getByRole("button", { name: "Lưu Tiếng Việt" }).click()
  await expect(page.getByText("Bắt buộc")).toBeVisible()
  expect(put.length).toBe(0)
  await page.getByLabel("Tiêu đề email *").click()
  await page.getByTestId("et-variables").getByRole("button", { name: "{user_name}" }).click()
  await expect(page.getByLabel("Tiêu đề email *")).toHaveValue("Chào {user_name}")
  await page.getByLabel("Nội dung email (HTML) *").fill("<p>Xin chào</p>")
  await page.getByRole("button", { name: "Lưu Tiếng Việt" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ subject: "Chào {user_name}", content: "<p>Xin chào</p>" })
})

test("ET-003 tên người gửi và xem trước trong iframe sandbox (không chạy script)", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/email-templates/1", { method: "GET", body: ok(DETAIL) })
  const from = await mockApi(page, "/v1/settings/admin/email-templates/1/settings", { method: "PUT", body: ok({ ...DETAIL, template: { ...ROW, fromName: "E2E Team" } }) })
  const prev = await mockApi(page, "/v1/settings/admin/email-templates/1/preview/en", { body: ok({ fromName: "E2E App", subject: "Welcome [user_name]", html: "<p id='x'>Hello [user_name]</p><script>parent.document.title='pwned'</script>" }) })
  await page.goto("/email-templates/1")
  await page.getByLabel("Tên người gửi").fill(" E2E Team ")
  await page.getByRole("button", { name: "Lưu", exact: true }).click()
  await expect.poll(() => from.length).toBe(1)
  expect(from[0]).toEqual({ fromName: "E2E Team" })
  await page.getByRole("tab", { name: "Tiếng Anh" }).click()
  await page.getByRole("button", { name: "Xem trước" }).click()
  await expect.poll(() => prev.length).toBe(1)
  await expect(page.getByTestId("et-preview-subject")).toHaveText("Welcome [user_name]")
  const frame = page.locator("iframe")
  await expect(frame).toHaveAttribute("sandbox", "")
  await expect(frame.contentFrame().locator("#x")).toHaveText("Hello [user_name]")
  expect(await page.title()).not.toBe("pwned")
})
