// @ts-check
/**
 * Sales returns (manual §6.3).
 * Spec sources: commerce-service SalesReturnController — GET /sales/returns, GET /sales/returns/returnable?invoiceId,
 * POST /sales/returns (ReturnForm {invoiceId, warehouseId?, returnDate, reason, notes, lines [{invoiceLineId, quantity,
 * reason}]}), /{id}/approve (DRAFT → APPROVED), /{id}/complete (APPROVED → COMPLETED); SAL_011 (more than returnable).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { CUSTOMERS, INVOICES, ITEMS, RETURNABLE, RETURNS, SALES_ALL, WAREHOUSES } from "./data.js"

/** @param {import('@playwright/test').Page} page */
async function openReturns(page) {
  await mockLoggedIn(page, { permissions: SALES_ALL })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf(CUSTOMERS) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  const list = await mockApi(page, "/v1/sales/returns", { method: "GET", body: pageOf(RETURNS) })
  await mockApi(page, "/v1/sales/invoices", { method: "GET", body: pageOf(INVOICES) })
  const returnable = await mockApi(page, "/v1/sales/returns/returnable", { body: ok(RETURNABLE) })
  await page.goto("/sales/returns")
  await expect(page.getByText("SR-2026-11-001", { exact: true })).toBeVisible()
  return { list, returnable }
}

test("RET-001 tạo phiếu trả: chỉ hóa đơn đã ghi sổ, quá số còn trả bị chặn (SAL_011), gửi đúng ReturnForm @smoke", async ({ page }) => {
  const { returnable } = await openReturns(page)
  const create = await mockApi(page, "/v1/sales/returns", { method: "POST", body: ok({ ret: RETURNS[0] }) })
  await page.getByRole("button", { name: "Tạo phiếu trả hàng" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Hóa đơn gốc" }).click()
  await expect(page.getByRole("option", { name: /SI-2026-11-001/ })).toHaveCount(0) // a draft cannot be returned
  await page.getByRole("option", { name: /SI-2026-11-002/ }).click()
  await expect.poll(() => returnable.requests.at(-1)?.url.searchParams.get("invoiceId")).toBe("301")

  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Nhập số lượng trả cho ít nhất một dòng")).toBeVisible()
  await dialog.getByLabel("Số lượng trả của E2E Bàn phím").fill("3")
  await expect(dialog.getByText("Chỉ còn trả được tối đa 2")).toBeVisible()
  await dialog.getByLabel("Số lượng trả của E2E Bàn phím").fill("1")
  await dialog.getByLabel("Lý do trả E2E Bàn phím").fill("E2E hỏng phím")
  await dialog.getByLabel("Ngày trả hàng").fill("2026-11-21")
  await expect(dialog.getByTestId("ret-total")).toContainText("110.000") // 1 × 100.000 + VAT 10%
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    invoiceId: 301,
    warehouseId: null,
    returnDate: "2026-11-21",
    reason: null,
    notes: null,
    lines: [{ invoiceLineId: 900, quantity: 1, reason: "E2E hỏng phím" }],
  })
})

test("RET-002 duyệt phiếu nháp và hoàn tất phiếu đã duyệt qua xác nhận", async ({ page }) => {
  const { list } = await openReturns(page)
  const approve = await mockApi(page, "/v1/sales/returns/50/approve", { body: ok({ ret: { ...RETURNS[0], status: "APPROVED" } }) })
  const complete = await mockApi(page, "/v1/sales/returns/51/complete", { body: ok({ ret: { ...RETURNS[1], status: "COMPLETED" } }) })

  await page.getByRole("button", { name: "Thao tác cho SR-2026-11-002" }).click()
  await expect(page.getByRole("menuitem", { name: "Duyệt" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Sửa" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Hoàn tất" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("nhập lại vào kho nhận")
  await page.getByRole("alertdialog").getByRole("button", { name: "Hoàn tất" }).click()
  await expect.poll(() => complete.requests.length).toBe(1)

  const before = list.requests.length
  await page.getByRole("button", { name: "Thao tác cho SR-2026-11-001" }).click()
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approve.requests.length).toBe(1)
  await expect.poll(() => list.requests.length).toBe(before + 1) // list reloaded
})

test("RET-003 lỗi backend khi tạo (SAL_011) → toast message, form vẫn mở", async ({ page }) => {
  await openReturns(page)
  await mockApi(page, "/v1/sales/returns", {
    method: "POST",
    status: 400,
    body: { result: false, code: "SAL_011", message: "E2E Số lượng trả vượt quá số còn trả." },
  })
  await page.getByRole("button", { name: "Tạo phiếu trả hàng" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Hóa đơn gốc" }).click()
  await page.getByRole("option", { name: /SI-2026-11-002/ }).click()
  await dialog.getByLabel("Số lượng trả của E2E Bàn phím").fill("2")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(page.getByText("E2E Số lượng trả vượt quá số còn trả.")).toBeVisible()
  await expect(dialog).toBeVisible()
})
