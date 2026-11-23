// @ts-check
/**
 * §3.5 Notification templates (Slack / Telegram / SMS). Spec: iam-service ChatNotificationTemplateController
 * /v1/settings/notification-templates/{channel} (IAM_SETTINGS_MANAGE): list (configured flag, events by module),
 * GET /{eventType}, PUT /{eventType}/{lang} {text} (≤1000 Slack/Telegram, ≤1600 SMS; SETTINGS_022 when not
 * configured), DELETE (reset, allowed when not configured), POST preview {text}.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const LIST = (configured) => ({ channel: "slack", configured, modules: [{ module: "HELPDESK", events: [{ eventType: "iam.helpdesk.ticket_created", name: "E2E New ticket", customisedLanguages: ["en"], variables: ["number", "title"] }] }] })
const VIEW = (configured) => ({
  channel: "slack",
  configured,
  eventType: "iam.helpdesk.ticket_created",
  name: "E2E New ticket",
  module: "HELPDESK",
  variables: ["number", "title"],
  languages: [
    { lang: "vi", customised: false, text: null },
    { lang: "en", customised: true, text: "Ticket {number}" },
    { lang: "ko", customised: false, text: null },
  ],
})

/** @param {import('@playwright/test').Page} page @param {boolean} configured */
async function open(page, configured) {
  await mockLoggedIn(page, { permissions: ["IAM_SETTINGS_MANAGE"] })
  await mockApi(page, "/v1/settings/notification-templates/slack", { body: ok(LIST(configured)) })
  await mockApi(page, "/v1/settings/notification-templates/slack/iam.helpdesk.ticket_created", { method: "GET", body: ok(VIEW(configured)) })
  await page.goto("/company/settings?tab=notification-templates")
  await expect(page.getByRole("button", { name: /E2E New ticket/ })).toBeVisible()
}

test("CTPL-001 kênh đã cấu hình: viết tin tiếng Việt, đếm ký tự, chặn biến lạ, xem trước dạng chữ, lưu @smoke", async ({ page }) => {
  await open(page, true)
  const put = await mockApi(page, "/v1/settings/notification-templates/slack/iam.helpdesk.ticket_created/vi", { method: "PUT", body: ok(VIEW(true)) })
  const prev = await mockApi(page, "/v1/settings/notification-templates/slack/iam.helpdesk.ticket_created/vi/preview", { method: "POST", body: ok({ text: "Yêu cầu [number]: <b>[title]</b>" }) })
  await expect(page.getByTestId("ctpl-not-configured")).toHaveCount(0)
  const box = page.getByLabel("Tin nhắn *")
  await box.fill("Yêu cầu {amount}")
  await expect(page.getByText("Không phải biến của sự kiện này: {amount}")).toBeVisible()
  await box.fill("Yêu cầu ")
  await page.getByTestId("ctpl-variables").getByRole("button", { name: "{number}" }).click()
  await expect(box).toHaveValue("Yêu cầu {number}")
  await expect(page.getByTestId("ctpl-count")).toHaveText("16 / 1000")
  await page.getByRole("button", { name: "Xem trước" }).click()
  await expect.poll(() => prev.length).toBe(1)
  expect(prev[0]).toEqual({ text: "Yêu cầu {number}" })
  // shown as text, not HTML
  await expect(page.getByTestId("ctpl-preview")).toHaveText("Yêu cầu [number]: <b>[title]</b>")
  await page.getByRole("button", { name: "Lưu", exact: true }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ text: "Yêu cầu {number}" })
})

test("CTPL-002 kênh chưa cấu hình: chỉ xem, có liên kết tới Tích hợp, vẫn đưa về mặc định được", async ({ page }) => {
  await open(page, false)
  const del = await mockApi(page, "/v1/settings/notification-templates/slack/iam.helpdesk.ticket_created/en", { method: "DELETE", body: ok(null) })
  await expect(page.getByTestId("ctpl-not-configured")).toContainText("Slack chưa được cấu hình")
  await expect(page.getByRole("link", { name: "Mở Tích hợp" })).toHaveAttribute("href", "/company/settings?tab=integrations")
  await expect(page.getByLabel("Tin nhắn *")).toBeDisabled()
  await expect(page.getByRole("button", { name: "Lưu", exact: true })).toHaveCount(0)
  await page.getByRole("tab", { name: /Tiếng Anh/ }).click()
  await page.getByRole("button", { name: "Về mặc định" }).click()
  await page.getByRole("alertdialog").getByRole("button").last().click()
  await expect.poll(() => del.length).toBe(1)
})

test("CTPL-003 SMS cho tối đa 1600 ký tự; không có IAM_SETTINGS_MANAGE thì không có tab", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["IAM_SETTINGS_MANAGE"] })
  await mockApi(page, "/v1/settings/notification-templates/slack", { body: ok(LIST(true)) })
  await mockApi(page, "/v1/settings/notification-templates/sms", { body: ok({ ...LIST(true), channel: "sms" }) })
  await mockApi(page, "/v1/settings/notification-templates/sms/iam.helpdesk.ticket_created", { body: ok({ ...VIEW(true), channel: "sms" }) })
  await mockApi(page, "/v1/settings/notification-templates/slack/iam.helpdesk.ticket_created", { body: ok(VIEW(true)) })
  await page.goto("/company/settings?tab=notification-templates")
  await page.getByRole("tab", { name: "SMS (Twilio)" }).click()
  await page.getByLabel("Tin nhắn *").fill("x".repeat(1200))
  await expect(page.getByTestId("ctpl-count")).toHaveText("1200 / 1600")
  await page.getByLabel("Tin nhắn *").fill("x".repeat(1601))
  await expect(page.getByText("Tối đa 1600 ký tự")).toBeVisible()

  await mockLoggedIn(page, { permissions: ["NOTIFICATION_SETTINGS_UPDATE"] })
  await page.goto("/company/settings")
  await expect(page.getByRole("tab", { name: "Mẫu thông báo" })).toHaveCount(0)
})
