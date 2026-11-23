// @ts-check
/**
 * §6 "Print / PDF" of a sales document: the staff API has no PDF endpoint (only the client portal), so the detail
 * dialog opens a printable copy in a new window and calls print() ("Save as PDF" there gives the file). The copy shows
 * what the dialog shows; every text is escaped.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { CUSTOMERS, DETAIL, INVOICE_COUNTS, INVOICES, ITEMS, SALES_ALL, WAREHOUSES } from "./data.js"

const XSS = `E2E <img src=x onerror="window.__xss=1"> Bàn phím`
const INVOICE_DETAIL = {
  ...DETAIL,
  document: { ...INVOICES[0], discount: 0 },
  notes: "E2E dòng 1\nE2E dòng 2",
  lines: [{ ...DETAIL.lines[0], itemName: XSS }],
}

/** @param {import('@playwright/test').Page} page */
async function open(page) {
  await mockLoggedIn(page, { permissions: SALES_ALL })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf(CUSTOMERS) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  await mockApi(page, "/v1/sales/invoices", { method: "GET", body: pageOf(INVOICES) })
  await mockApi(page, "/v1/sales/invoices/status-counts", { body: ok(INVOICE_COUNTS) })
  await mockApi(page, "/v1/sales/invoices/300", { body: ok(INVOICE_DETAIL) })
  await page.goto("/sales/invoices?view=300")
}

test("PRINT-001 In / Lưu PDF: cửa sổ in có loại + số chứng từ, khách hàng, dòng hàng, tổng @smoke", async ({ page }) => {
  await open(page)
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("sales-print").click()])
  await popup.waitForLoadState()
  await expect(popup).toHaveTitle("Hóa đơn bán hàng SI-2026-11-001")
  await expect(popup.locator("h1")).toContainText("Nháp")
  await expect(popup.getByText("E2E Công ty TNHH Ánh Dương")).toBeVisible()
  await expect(popup.locator("td").first()).toContainText("KB-01 · Sản phẩm")
  // totals as the dialog shows them (no currency settings mocked → no symbol); no discount = "0", not "-0"
  await expect(popup.locator("dl.t .s")).toContainText("220.000")
  await expect(popup.locator("dl.t")).not.toContainText("-0")
  await expect(popup.locator(".notes")).toContainText("E2E dòng 1\nE2E dòng 2")
})

test("PRINT-002 tên hàng có HTML được in nguyên văn, không chạy", async ({ page }) => {
  await open(page)
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("sales-print").click()])
  await popup.waitForLoadState()
  await expect(popup.locator("td").first()).toContainText(XSS)
  await expect(popup.locator("img")).toHaveCount(0)
  expect(await popup.evaluate(() => Reflect.get(window, "__xss") ?? 0)).toBe(0)
})

test("PRINT-003 trình duyệt chặn cửa sổ bật lên → báo lỗi", async ({ page }) => {
  await open(page)
  await page.evaluate(() => {
    window.open = () => null
  })
  await page.getByTestId("sales-print").click()
  await expect(page.getByText("Trình duyệt đã chặn cửa sổ in")).toBeVisible()
})
