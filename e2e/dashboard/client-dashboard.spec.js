// @ts-check
/**
 * §5 role view Client (portal). Spec: report-service GET /v1/reports/client-dashboard?year (PORTAL_CLIENT) → parts
 * payments {totalSettled, monthly, notesTotal, notesCount} (ACC_098 = account not linked to a customer), deals {count},
 * openTickets {count}. A user holding only portal permissions (seeded CLIENT role) gets this view.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const CLIENT = ["PORTAL_CLIENT", "SUPPORT_TICKET_VIEW_OWN", "SUPPORT_TICKET_MANAGE_OWN"]
const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: i === 10 ? 1500000 : 0 }))
const LINKED = {
  year: 2026,
  parts: {
    payments: { data: { year: 2026, totalSettled: 2500000, monthly: months, notesTotal: 300000, notesCount: 2 }, error: null },
    deals: { data: { count: 5 }, error: null },
    openTickets: { data: { count: 1 }, error: null },
  },
}
const UNLINKED = {
  year: 2026,
  parts: { payments: { data: null, error: "ACC_098" }, deals: { data: null, error: "ACC_098" }, openTickets: { data: { count: 0 }, error: null } },
}

/** @param {import('@playwright/test').Page} page @param {string[]} permissions @param {object} body */
async function open(page, permissions, body = LINKED) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/reports/dashboard", { body: ok({}) })
  await mockApi(page, "/v1/reports/calendar", { body: ok({ upcoming: [] }) })
  await mockApi(page, "/v1/reports/support-dashboard", { body: ok({ parts: {} }) })
  const client = await mockApi(page, "/v1/reports/client-dashboard", { body: ok(body) })
  await page.goto("/dashboard")
  return client
}

test("CLDASH-001 khách hàng: tổng đã thanh toán, credit note, cơ hội, yêu cầu mở; đổi năm gọi lại @smoke", async ({ page }) => {
  const client = await open(page, CLIENT)
  await expect(page.getByTestId("client-dashboard")).toBeVisible()
  await expect(page.getByTestId("portal-total-paid")).toContainText("2.500.000")
  await expect(page.getByTestId("portal-notes")).toContainText("300.000")
  await expect(page.getByText("2 phiếu")).toBeVisible()
  await expect(page.getByTestId("portal-deals")).toHaveText("5")
  await expect(page.getByTestId("portal-open-tickets")).toHaveText("1")
  await expect(page.getByText("Thanh toán theo tháng")).toBeVisible()
  // no company tabs for a portal user (it also has SUPPORT_TICKET_VIEW_OWN)
  await expect(page.getByRole("tab")).toHaveCount(0)
  const year = new Date().getFullYear()
  expect(client.requests[0].url.searchParams.get("year")).toBe(String(year))
  await page.getByRole("combobox", { name: "Năm" }).click()
  await page.getByRole("option", { name: String(year - 1) }).click()
  await expect.poll(() => client.requests.at(-1)?.url.searchParams.get("year")).toBe(String(year - 1))
})

test("CLDASH-002 tài khoản chưa liên kết khách hàng (ACC_098): báo một lần, ẩn biểu đồ", async ({ page }) => {
  await open(page, CLIENT, UNLINKED)
  await expect(page.getByTestId("portal-not-linked")).toContainText("chưa được liên kết với khách hàng")
  await expect(page.getByTestId("portal-total-paid")).toHaveText("-")
  await expect(page.getByText("Toàn bộ thời gian")).toHaveCount(0)
  await expect(page.getByTestId("portal-open-tickets")).toHaveText("0")
  await expect(page.getByText("Thanh toán theo tháng")).toHaveCount(0)
})

test("CLDASH-003 người dùng công ty có PORTAL_CLIENT (Company Admin) vẫn xem dashboard công ty", async ({ page }) => {
  const client = await open(page, ["EMPLOYEE_VIEW", "PORTAL_CLIENT", "PORTAL_VENDOR"])
  await expect(page.getByRole("tab", { name: "Nhân sự" })).toBeVisible()
  await expect(page.getByTestId("client-dashboard")).toHaveCount(0)
  expect(client.length).toBe(0)
})
