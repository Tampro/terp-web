// @ts-check
/**
 * §3.7 Language management. Spec: iam-service LanguageController /v1/settings/admin/languages (list, POST {code, name,
 * countryCode}, PUT /{code} {name, countryCode, enabled}, DELETE, /{code}/labels GET page + PUT {key: text}, /import);
 * PublicLanguageController GET /v1/languages (selector) and /v1/languages/{code}/labels (runtime texts of languages the
 * app does not ship).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const LANGS = [
  { id: "1", code: "vi", name: "Tiếng Việt", countryCode: "VN", enabled: true, system: true, isDefault: true },
  { id: "2", code: "en", name: "English", countryCode: "GB", enabled: true, system: true, isDefault: false },
  { id: "9", code: "ja", name: "E2E 日本語", countryCode: "JP", enabled: true, system: false, isDefault: false },
]

test("LANG-001 danh sách: ngôn ngữ mặc định không tắt được, chỉ xóa được ngôn ngữ tự thêm; tắt gửi PUT enabled=false @smoke", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/languages", { method: "GET", body: ok(LANGS) })
  const put = await mockApi(page, "/v1/settings/admin/languages/ja", { method: "PUT", body: ok({ ...LANGS[2], enabled: false }) })
  await page.goto("/settings?tab=languages")
  await expect(page.getByRole("switch", { name: "Bật Tiếng Việt" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Xóa Tiếng Việt" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Xóa English" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Xóa E2E 日本語" })).toBeVisible()
  await page.getByRole("switch", { name: "Bật E2E 日本語" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ name: "E2E 日本語", countryCode: "JP", enabled: false })
})

test("LANG-002 thêm ngôn ngữ: kiểm mã và cờ; đồng bộ chữ của ứng dụng gửi vi/en/ko", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/languages", { method: "GET", body: ok(LANGS) })
  const create = await mockApi(page, "/v1/settings/admin/languages", { method: "POST", body: ok(LANGS[2]) })
  const imports = await Promise.all(["vi", "en", "ko"].map((c) => mockApi(page, `/v1/settings/admin/languages/${c}/labels/import`, { method: "POST", body: ok({ added: 1, updated: 0 }) })))
  await page.goto("/settings?tab=languages")
  await page.getByRole("button", { name: "Đồng bộ chữ của ứng dụng" }).click()
  await expect(page.getByText("Đã đồng bộ: thêm 3, cập nhật 0")).toBeVisible()
  const viFile = /** @type {Record<string, string>} */ (imports[0][0])
  expect(viFile["lang.tab"]).toBe("Ngôn ngữ")
  expect(Object.keys(viFile).length).toBeGreaterThan(1000)
  await page.getByRole("button", { name: "Thêm ngôn ngữ" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Mã *").fill("JA")
  await dlg.getByLabel("Tên *").fill("E2E 日本語")
  await dlg.getByLabel("Quốc gia (cờ)").fill("jp")
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dlg.getByText("Dùng mã dạng ja hoặc zh-TW")).toBeVisible()
  expect(create.length).toBe(0)
  await dlg.getByLabel("Mã *").fill("ja")
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ code: "ja", name: "E2E 日本語", countryCode: "JP" })
})

test("LANG-003 chữ của một ngôn ngữ: chỉ gửi các chữ đã sửa", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/settings/admin/languages", { method: "GET", body: ok(LANGS) })
  await mockApi(page, "/v1/settings/admin/languages/ja/labels", {
    method: "GET",
    body: pageOf([
      { key: "common.save", value: "保存", defaultValue: "Lưu thay đổi", translated: true },
      { key: "common.cancel", value: "Hủy", defaultValue: "Hủy", translated: false },
    ]),
  })
  const put = await mockApi(page, "/v1/settings/admin/languages/ja/labels", { method: "PUT", body: ok({ updated: 1 }) })
  await page.goto("/settings?tab=languages")
  await page.getByRole("button", { name: "Chữ của E2E 日本語" }).click()
  const dlg = page.getByRole("dialog")
  await expect(dlg.getByRole("textbox", { name: "common.save" })).toHaveValue("保存")
  // untranslated: empty, default shown as placeholder
  await expect(dlg.getByRole("textbox", { name: "common.cancel" })).toHaveValue("")
  await expect(dlg.getByRole("textbox", { name: "common.cancel" })).toHaveAttribute("placeholder", "Hủy")
  await dlg.getByRole("textbox", { name: "common.cancel" }).fill("キャンセル")
  await expect(dlg.getByText("1 thay đổi chưa lưu")).toBeVisible()
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ "common.cancel": "キャンセル" })
})

test("LANG-004 chọn ngôn ngữ ngoài vi/en/ko: nạp chữ từ backend, khóa thiếu dùng tiếng Anh", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  const labels = await mockApi(page, "/v1/languages/ja/labels", { body: ok({ "loginHistory.title": "E2E ログイン履歴" }) })
  await mockApi(page, "/v1/iam/login-history", { body: pageOf([]) })
  await mockApi(page, "/v1/iam/companies", { body: pageOf([]) })
  await page.addInitScript(() => localStorage.setItem("erp.language", JSON.stringify({ state: { language: "ja" }, version: 0 })))
  await page.goto("/companies/login-history")
  await expect(page.getByRole("heading", { name: "E2E ログイン履歴" })).toBeVisible()
  // a key the backend does not have: English
  await expect(page.getByText("Every login to the platform, newest first.")).toBeVisible()
  expect(labels.length).toBe(1)
})
