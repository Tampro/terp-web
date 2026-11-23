// @ts-check
/**
 * §6 "Sync to Google Calendar". Spec (commerce SalesDtos, employee HolidayDtos, notification EEventRoute, 2026-11-23):
 * DocumentForm.syncToGoogleCalendar (invoices only; omitted = false) and DocumentDetail.syncToGoogleCalendar — the due
 * date goes to the company's Google Calendar when the invoice is posted; HolidayForm.calendarSync — the holiday is
 * created / updated / deleted on the calendar. Both need the Google Calendar integration (else no delivery row).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { CUSTOMERS, DETAIL, INVOICE_COUNTS, INVOICES, ITEMS, QUOTATION_COUNTS, QUOTATIONS, SALES_ALL, WAREHOUSES } from "./data.js"

/** @param {import('@playwright/test').Page} page */
async function lookups(page) {
  await mockLoggedIn(page, { permissions: [...SALES_ALL, "LEAVE_VIEW", "LEAVE_MANAGE", "ORG_VIEW", "ORG_MANAGE"] })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf(CUSTOMERS) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
}

test("GCAL-001 tạo hóa đơn: bật Đồng bộ Google Calendar → gửi syncToGoogleCalendar true; chi tiết hiện Có @smoke", async ({ page }) => {
  await lookups(page)
  await mockApi(page, "/v1/sales/invoices", { method: "GET", body: pageOf(INVOICES) })
  await mockApi(page, "/v1/sales/invoices/status-counts", { body: ok(INVOICE_COUNTS) })
  const create = await mockApi(page, "/v1/sales/invoices", { method: "POST", body: ok(DETAIL) })
  await mockApi(page, "/v1/sales/invoices/300", { body: ok({ ...DETAIL, document: INVOICES[0], syncToGoogleCalendar: true }) })
  await page.goto("/sales/invoices")
  await page.getByRole("button", { name: "Tạo hóa đơn" }).click()
  const dialog = page.getByRole("dialog")
  const sw = dialog.getByRole("switch", { name: "Đồng bộ Google Calendar" })
  await expect(sw).not.toBeChecked()
  await expect(dialog.getByText("cần bật tích hợp Google Calendar")).toBeVisible()
  await dialog.getByRole("combobox", { name: "Loại hóa đơn" }).click()
  await page.getByRole("option", { name: "Theo dịch vụ" }).click()
  await dialog.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E Công ty TNHH Ánh Dương" }).click()
  await dialog.getByRole("combobox", { name: "Mặt hàng dòng 1" }).click()
  await page.getByRole("option", { name: "E2E Lắp đặt (SV-01)" }).click()
  await sw.click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toMatchObject({ invoiceType: "SERVICE", syncToGoogleCalendar: true })

  await page.goto("/sales/invoices?view=300")
  const detail = page.getByRole("dialog")
  await expect(detail.locator("dl > div").filter({ has: page.locator("dt", { hasText: "Đồng bộ Google Calendar" }) }).locator("dd")).toHaveText("Có")
})

test("GCAL-002 báo giá: không có công tắc và không gửi syncToGoogleCalendar", async ({ page }) => {
  await lookups(page)
  await mockApi(page, "/v1/sales/quotations", { method: "GET", body: pageOf(QUOTATIONS) })
  await mockApi(page, "/v1/sales/quotations/status-counts", { body: ok(QUOTATION_COUNTS) })
  const create = await mockApi(page, "/v1/sales/quotations", { method: "POST", body: ok(DETAIL) })
  await page.goto("/sales/quotations")
  await page.getByRole("button", { name: "Tạo báo giá" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("switch", { name: "Đồng bộ Google Calendar" })).toHaveCount(0)
  await dialog.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E Công ty TNHH Ánh Dương" }).click()
  await dialog.getByRole("combobox", { name: "Mặt hàng dòng 1" }).click()
  await page.getByRole("option", { name: /E2E Bàn phím/ }).click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).not.toHaveProperty("syncToGoogleCalendar")
})

test("GCAL-003 ngày lễ: công tắc Đồng bộ Google Calendar gửi calendarSync; cột hiện trạng thái", async ({ page }) => {
  await lookups(page)
  await mockApi(page, "/v1/org/branches/options", { body: ok([{ id: "24", name: "E2E HCM" }]) })
  await mockApi(page, "/v1/attendance/leave/types/options", { body: ok([]) })
  await mockApi(page, "/v1/attendance/leave/applications", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/org/holiday-categories", { method: "GET", body: ok([{ id: "3", name: "E2E Quốc lễ", color: "#2563EB" }]) })
  await mockApi(page, "/v1/org/holidays", {
    method: "GET",
    body: pageOf([{ id: "9", name: "E2E Tết", category: { id: "3", name: "E2E Quốc lễ" }, startDate: "2027-02-16", endDate: "2027-02-20", days: 5, isPaid: true, allBranches: true, calendarSync: true }]),
  })
  const create = await mockApi(page, "/v1/org/holidays", { method: "POST", body: ok({ id: "10" }) })
  await page.goto("/hrm/leave")
  await page.getByRole("tab", { name: "Ngày lễ" }).click()
  const row = page.getByRole("row").filter({ hasText: "E2E Tết" })
  await expect(row).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Đồng bộ Google Calendar" })).toBeVisible()
  await page.getByRole("button", { name: /Thêm ngày lễ|Tạo ngày lễ/ }).click()
  const d = page.getByRole("dialog")
  await d.getByLabel("Tên *").fill("E2E Giỗ Tổ")
  await d.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "E2E Quốc lễ" }).click()
  await d.getByLabel("Ngày bắt đầu *").fill("2027-04-16")
  await d.getByLabel("Ngày kết thúc *").fill("2027-04-16")
  await d.getByRole("switch", { name: "Đồng bộ Google Calendar" }).click()
  await d.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toMatchObject({ name: "E2E Giỗ Tổ", calendarSync: true })
})
