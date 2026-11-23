// @ts-check
/**
 * §5 role view Vendor (portal). Spec: report-service GET /v1/reports/vendor-dashboard?year (PORTAL_VENDOR) → parts
 * payments {totalSettled = received, monthly, notesTotal / notesCount = debit notes} (ACC_098 = account not linked to a
 * vendor), purchaseInvoices {count}, requests always NOT_AVAILABLE (not shown). Seeded VENDOR role = PORTAL_VENDOR only.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: i === 9 ? 4200000 : 0 }))
const VENDOR = {
  year: 2026,
  parts: {
    payments: { data: { year: 2026, totalSettled: 4200000, monthly: months, notesTotal: 150000, notesCount: 1 }, error: null },
    purchaseInvoices: { data: { count: 7 }, error: null },
    requests: { data: null, error: "NOT_AVAILABLE" },
  },
}
const CLIENT = {
  year: 2026,
  parts: { payments: { data: { totalSettled: 2500000, monthly: [], notesTotal: 0, notesCount: 0 }, error: null }, deals: { data: { count: 5 }, error: null }, openTickets: { data: { count: 1 }, error: null } },
}

/** @param {import('@playwright/test').Page} page @param {string[]} permissions @param {object} body */
async function open(page, permissions, body = VENDOR) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/reports/dashboard", { body: ok({}) })
  await mockApi(page, "/v1/reports/calendar", { body: ok({ upcoming: [] }) })
  const vendor = await mockApi(page, "/v1/reports/vendor-dashboard", { body: ok(body) })
  const client = await mockApi(page, "/v1/reports/client-dashboard", { body: ok(CLIENT) })
  await page.goto("/dashboard")
  return { vendor, client }
}

test("VNDASH-001 nhà cung cấp: tổng đã nhận, debit note, hoá đơn mua; không có thẻ yêu cầu @smoke", async ({ page }) => {
  const { vendor, client } = await open(page, ["PORTAL_VENDOR"])
  await expect(page.getByTestId("vendor-dashboard")).toBeVisible()
  await expect(page.getByText("Tổng quan giao dịch của bạn với công ty")).toBeVisible()
  await expect(page.getByTestId("portal-total-paid")).toContainText("4.200.000")
  await expect(page.getByText("Tổng đã nhận")).toBeVisible()
  await expect(page.getByTestId("portal-notes")).toContainText("150.000")
  await expect(page.getByText("Debit note")).toBeVisible()
  await expect(page.getByTestId("portal-purchase-invoices")).toHaveText("7")
  await expect(page.getByText("Tiền nhận theo tháng")).toBeVisible()
  await expect(page.getByTestId("portal-deals")).toHaveCount(0)
  await expect(page.getByRole("tab")).toHaveCount(0)
  expect(vendor.requests[0].url.searchParams.get("year")).toBe(String(new Date().getFullYear()))
  expect(client.length).toBe(0)
})

test("VNDASH-002 chưa liên kết nhà cung cấp (ACC_098): báo một lần, ẩn biểu đồ", async ({ page }) => {
  await open(page, ["PORTAL_VENDOR"], {
    parts: { payments: { data: null, error: "ACC_098" }, purchaseInvoices: { data: null, error: "ACC_098" }, requests: { data: null, error: "NOT_AVAILABLE" } },
  })
  await expect(page.getByTestId("portal-not-linked")).toContainText("chưa được liên kết với nhà cung cấp")
  await expect(page.getByTestId("portal-purchase-invoices")).toHaveText("-")
  await expect(page.getByText("Tiền nhận theo tháng")).toHaveCount(0)
})

test("VNDASH-003 có cả hai quyền cổng: tab Khách hàng / Nhà cung cấp, mỗi tab chỉ tải khi mở", async ({ page }) => {
  const { vendor, client } = await open(page, ["PORTAL_CLIENT", "PORTAL_VENDOR", "SUPPORT_TICKET_VIEW_OWN"])
  await expect(page.getByRole("tab")).toHaveText(["Khách hàng", "Nhà cung cấp"])
  await expect(page.getByTestId("client-dashboard").getByTestId("portal-deals")).toHaveText("5")
  expect(vendor.length).toBe(0)
  await page.getByRole("tab", { name: "Nhà cung cấp" }).click()
  await expect(page.getByTestId("vendor-dashboard").getByTestId("portal-purchase-invoices")).toHaveText("7")
  expect(vendor.length).toBe(1)
  expect(client.length).toBe(1)
})
