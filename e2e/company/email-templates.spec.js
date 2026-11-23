// @ts-check
/**
 * Business email templates of the company. Spec: iam-service EmailNotificationTemplateController
 * /v1/settings/email-notification-templates (NOTIFICATION_SETTINGS_UPDATE): grouped list, GET /{code} (variables,
 * text per language, null = built-in default), PUT /{code}/{lang} {subject, body}, DELETE (reset), POST preview.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const GROUPS = [
  { module: "GENERAL", templates: [{ code: "INVOICE_SENT", name: "E2E Invoice Send", module: "GENERAL", customisedLanguages: ["en"], customised: true, variables: ["number", "total"] }] },
  { module: "CRM", templates: [{ code: "LEAD_ASSIGNED", name: "E2E Lead Assigned", module: "CRM", customisedLanguages: [], customised: false, variables: ["lead"] }] },
]
const VIEW = {
  code: "INVOICE_SENT",
  name: "E2E Invoice Send",
  module: "GENERAL",
  variables: ["number", "total"],
  languages: [
    { lang: "vi", customised: false, subject: null, body: null },
    { lang: "en", customised: true, subject: "Invoice {number}", body: "<p>Total {total}</p>" },
    { lang: "ko", customised: false, subject: null, body: null },
  ],
}

/** @param {import('@playwright/test').Page} page */
async function open(page) {
  await mockLoggedIn(page, { permissions: ["NOTIFICATION_SETTINGS_UPDATE"] })
  await mockApi(page, "/v1/settings/email-notification-templates", { body: ok(GROUPS) })
  await mockApi(page, "/v1/settings/email-notification-templates/INVOICE_SENT", { method: "GET", body: ok(VIEW) })
  await page.goto("/company/settings?tab=email-templates")
  await expect(page.getByRole("button", { name: /E2E Invoice Send/ })).toBeVisible()
}

test("ETPL-001 tiếng Việt dùng chữ mặc định: viết tiêu đề + nội dung, chèn biến, chặn biến lạ, lưu đúng ngôn ngữ @smoke", async ({ page }) => {
  await open(page)
  const put = await mockApi(page, "/v1/settings/email-notification-templates/INVOICE_SENT/vi", { method: "PUT", body: ok(VIEW) })
  await expect(page.getByTestId("etpl-state")).toContainText("chữ mặc định")
  await page.getByLabel("Tiêu đề *").fill("Hóa đơn ")
  await page.getByLabel("Tiêu đề *").click()
  await page.getByTestId("etpl-variables").getByRole("button", { name: "{number}" }).click()
  await expect(page.getByLabel("Tiêu đề *")).toHaveValue("Hóa đơn {number}")
  await page.getByLabel("Nội dung (HTML) *").fill("<p>Tổng {amount}</p>")
  await expect(page.getByText("Không phải biến của mẫu này: {amount}")).toBeVisible()
  await page.getByRole("button", { name: "Lưu", exact: true }).click()
  expect(put.length).toBe(0)
  await page.getByLabel("Nội dung (HTML) *").fill("<p>Tổng {total}</p>")
  await page.getByRole("button", { name: "Lưu", exact: true }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ subject: "Hóa đơn {number}", body: "<p>Tổng {total}</p>" })
})

test("ETPL-002 tiếng Anh đã tùy chỉnh: xem trước trong iframe sandbox, về mặc định qua xác nhận (DELETE)", async ({ page }) => {
  await open(page)
  const prev = await mockApi(page, "/v1/settings/email-notification-templates/INVOICE_SENT/en/preview", { method: "POST", body: ok({ subject: "Invoice [number]", body: "<p id='x'>Total [total]</p><script>parent.document.title='pwned'</script>" }) })
  const del = await mockApi(page, "/v1/settings/email-notification-templates/INVOICE_SENT/en", { method: "DELETE", body: ok(null) })
  await page.getByRole("tab", { name: /Tiếng Anh/ }).click()
  await expect(page.getByTestId("etpl-state")).toContainText("chữ riêng của công ty")
  await expect(page.getByLabel("Tiêu đề *")).toHaveValue("Invoice {number}")
  await page.getByRole("button", { name: "Xem trước" }).click()
  await expect.poll(() => prev.length).toBe(1)
  expect(prev[0]).toEqual({ subject: "Invoice {number}", body: "<p>Total {total}</p>" })
  await expect(page.getByTestId("etpl-preview-subject")).toHaveText("Invoice [number]")
  await expect(page.locator("iframe")).toHaveAttribute("sandbox", "")
  await expect(page.locator("iframe").contentFrame().locator("#x")).toHaveText("Total [total]")
  expect(await page.title()).not.toBe("pwned")
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click()
  await page.getByRole("button", { name: "Về mặc định" }).click()
  await page.getByRole("alertdialog").getByRole("button").last().click()
  await expect.poll(() => del.length).toBe(1)
})

test("ETPL-003 không có quyền NOTIFICATION_SETTINGS_UPDATE thì không có tab", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["IAM_SETTINGS_MANAGE"] })
  await page.goto("/company/settings")
  await expect(page.getByRole("tab", { name: "Mẫu email" })).toHaveCount(0)
})
