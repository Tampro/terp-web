// @ts-check
/**
 * Purchase invoices and returns (manual §8.1, §8.2).
 * Spec sources: commerce-service PurchaseInvoiceController / Service (InvoiceForm {vendorId, warehouseId, invoiceDate,
 * dueDate, paymentTerms, notes, lines}, /status-counts, /{id}/post), PurchaseReturnController / Service (ReturnForm,
 * /returnable, /{id}/approve|complete); PUR_004 (due before date), PUR_012 (nothing left to return); permissions
 * PURCHASE_VIEW / MANAGE / POST.
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { COUNTS, INVOICE_DETAIL, INVOICES, ITEMS, PURCHASE_ALL, RETURNABLE, RETURNS, VENDORS, WAREHOUSES } from "./data.js"

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function lookups(page, permissions = PURCHASE_ALL) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/accounting/vendors", { body: pageOf(VENDORS) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
}

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function openInvoices(page, permissions) {
  await lookups(page, permissions)
  const list = await mockApi(page, "/v1/purchase/invoices", { method: "GET", body: pageOf(INVOICES) })
  await mockApi(page, "/v1/purchase/invoices/status-counts", { body: ok(COUNTS) })
  await page.goto("/purchase/invoices")
  await expect(page.getByText("PI-2026-11-001", { exact: true })).toBeVisible()
  return list
}

/** @param {import('@playwright/test').Page} page @param {string} number */
const menu = (page, number) => page.getByRole("button", { name: `Thao tác cho ${number}` })

test("PUR-001 hóa đơn mua: số đếm tab, nhà cung cấp, kho, Quá hạn; tab Quá hạn gửi overdue=true @smoke", async ({ page }) => {
  const list = await openInvoices(page)
  await expect(page.getByRole("tab", { name: "Tất cả (2)" })).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: "PI-2026-11-001" })
  await expect(row).toContainText("E2E Global Supplies")
  await expect(row).toContainText("E2E Kho Hà Nội")
  await expect(row).toContainText("880.000")
  // subtotal and tax columns, as on the reference list
  await expect(page.getByRole("columnheader", { name: "Thuế" })).toBeVisible()
  await expect(row).toContainText("800.000")
  await expect(row).toContainText("80.000")
  await expect(row).toContainText("Quá hạn")
  await page.getByRole("tab", { name: "Quá hạn" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("overdue")).toBe("true")
  expect(list.requests.at(-1)?.url.searchParams.get("status")).toBeNull()
})

test("PUR-002 tạo hóa đơn mua: bắt buộc nhà cung cấp, hạn trước ngày bị chặn (PUR_004), gửi đúng InvoiceForm", async ({ page }) => {
  await openInvoices(page)
  const create = await mockApi(page, "/v1/purchase/invoices", { method: "POST", body: ok(INVOICE_DETAIL) })
  await page.getByRole("button", { name: "Tạo hóa đơn mua" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Ngày hóa đơn").fill("2026-11-20")
  await dialog.getByLabel("Hạn thanh toán").fill("2026-11-19")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Hãy chọn nhà cung cấp")).toBeVisible()
  await expect(dialog.getByText("Hạn không được trước ngày chứng từ")).toBeVisible()
  expect(create).toHaveLength(0)

  await dialog.getByRole("combobox", { name: "Nhà cung cấp" }).click()
  await page.getByRole("option", { name: "E2E 한빛 부품" }).click()
  await dialog.getByRole("combobox", { name: "Kho nhận hàng" }).click()
  await page.getByRole("option", { name: "E2E Kho HCM" }).click()
  await dialog.getByLabel("Hạn thanh toán").fill("2026-12-20")
  await dialog.getByRole("combobox", { name: "Mặt hàng dòng 1" }).click()
  await page.getByRole("option", { name: "E2E Keyboard (KB-01)" }).click()
  await expect(dialog.getByLabel("Đơn giá dòng 1")).toHaveAttribute("placeholder", "80000") // the purchase price
  await dialog.getByLabel("Số lượng dòng 1").fill("10")
  // preview: 10 × 80.000 = 800.000, VAT 10% = 80.000 → 880.000
  await expect(dialog.getByTestId("pi-summary")).toContainText("880.000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    vendorId: 702,
    warehouseId: 802,
    invoiceDate: "2026-11-20",
    dueDate: "2026-12-20",
    paymentTerms: null,
    notes: null,
    lines: [{ itemId: 601, quantity: 10 }],
  })
})

test("PUR-003 ghi sổ nháp qua xác nhận; lỗi backend (PUR_005) hiện message", async ({ page }) => {
  await openInvoices(page)
  const post = await mockApi(page, "/v1/purchase/invoices/902/post", {
    method: "POST",
    status: 400,
    body: fail("PUR_005", "Hóa đơn mua có mặt hàng tồn kho cần kho nhận hàng."),
  })
  await menu(page, "PI-2026-11-001").click()
  await expect(page.getByRole("menuitem", { name: "Ghi sổ" })).toHaveCount(0) // already posted
  await page.keyboard.press("Escape")
  await menu(page, "PI-2026-11-002").click()
  await page.getByRole("menuitem", { name: "Ghi sổ" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Ghi sổ" }).click()
  await expect.poll(() => post.length).toBe(1)
  await expect(page.getByText("Hóa đơn mua có mặt hàng tồn kho cần kho nhận hàng.")).toBeVisible()
})

test("PUR-004 chỉ PURCHASE_VIEW: không tạo, menu chỉ còn Xem; xem chi tiết qua ?view=", async ({ page }) => {
  await openInvoices(page, ["PURCHASE_VIEW"])
  await mockApi(page, "/v1/purchase/invoices/901", { method: "GET", body: ok(INVOICE_DETAIL) })
  await expect(page.getByRole("button", { name: "Tạo hóa đơn mua" })).toHaveCount(0)
  await menu(page, "PI-2026-11-002").click()
  await expect(page.getByRole("menuitem")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await menu(page, "PI-2026-11-001").click()
  await page.getByRole("menuitem", { name: "Xem" }).click()
  await expect(page).toHaveURL(/view=901/)
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("E2E Keyboard")
  await expect(dialog).toContainText("Net 30")
})

test("PUR-010 phiếu trả mua: chỉ hóa đơn đã ghi sổ, quá số còn trả bị chặn, gửi ReturnForm @smoke", async ({ page }) => {
  await lookups(page)
  await mockApi(page, "/v1/purchase/returns", { method: "GET", body: pageOf(RETURNS) })
  await mockApi(page, "/v1/purchase/invoices", { method: "GET", body: pageOf(INVOICES) })
  await mockApi(page, "/v1/purchase/returns/returnable", { body: ok(RETURNABLE) })
  const create = await mockApi(page, "/v1/purchase/returns", { method: "POST", body: ok({ ret: RETURNS[0] }) })
  await page.goto("/purchase/returns")
  await expect(page.getByRole("row").filter({ hasText: "PR-2026-11-001" })).toContainText("E2E Global Supplies")
  await page.getByRole("button", { name: "Tạo phiếu trả hàng mua" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Hóa đơn gốc" }).click()
  await expect(page.getByRole("option", { name: /PI-2026-11-002/ })).toHaveCount(0) // a draft cannot be returned
  await page.getByRole("option", { name: /PI-2026-11-001/ }).click()
  await dialog.getByLabel("Số lượng trả của E2E Keyboard").fill("9")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Chỉ còn trả được tối đa 8")).toBeVisible() // PUR_007
  expect(create).toHaveLength(0)
  await dialog.getByLabel("Số lượng trả của E2E Keyboard").fill("2")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toMatchObject({ invoiceId: 901, warehouseId: null, lines: [{ invoiceLineId: 11, quantity: 2, reason: null }] })
})

test("PUR-011 hóa đơn đã trả hết: hiện 'Không còn mặt hàng nào để trả' (PUR_012), không lưu được", async ({ page }) => {
  await lookups(page)
  await mockApi(page, "/v1/purchase/returns", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/purchase/invoices", { method: "GET", body: pageOf(INVOICES) })
  await mockApi(page, "/v1/purchase/returns/returnable", { status: 400, body: fail("PUR_012", "No items available for return.") })
  await page.goto("/purchase/returns")
  await page.getByRole("button", { name: "Tạo phiếu trả hàng mua" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Hóa đơn gốc" }).click()
  await page.getByRole("option", { name: /PI-2026-11-001/ }).click()
  await expect(dialog.getByText("Không còn mặt hàng nào để trả")).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Lưu" })).toBeDisabled()
})

test("PUR-012 duyệt phiếu nháp và hoàn tất phiếu đã duyệt (PURCHASE_POST)", async ({ page }) => {
  await lookups(page)
  await mockApi(page, "/v1/purchase/returns", { method: "GET", body: pageOf(RETURNS) })
  const approve = await mockApi(page, "/v1/purchase/returns/951/approve", { method: "POST", body: ok({}) })
  const complete = await mockApi(page, "/v1/purchase/returns/952/complete", { method: "POST", body: ok({}) })
  await page.goto("/purchase/returns")
  await menu(page, "PR-2026-11-001").click()
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approve.length).toBe(1)
  await menu(page, "PR-2026-11-002").click()
  await page.getByRole("menuitem", { name: "Hoàn tất" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("xuất khỏi kho")
  await page.getByRole("alertdialog").getByRole("button", { name: "Hoàn tất" }).click()
  await expect.poll(() => complete.length).toBe(1)
})
