// @ts-check
/**
 * Proposals, sales invoices, quotations (manual §6.1, §6.2, §6.4).
 * Spec sources: commerce-service SalesControllers — GET /sales/{proposals,invoices,quotations} (status, overdue,
 * customerId, from/to, keyword) + /status-counts; POST create (DocumentForm; SalesDtos.LineForm
 * {itemId, quantity, unitPrice, discountPct}); /{id}/send|accept|reject|convert|post|duplicate|versions;
 * SAL_002 (only a draft), SAL_007 (due before date); permissions SALES_* / QUOTATION_*.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import {
  CUSTOMERS,
  DETAIL,
  INVOICE_COUNTS,
  INVOICES,
  ITEMS,
  PROPOSAL_COUNTS,
  PROPOSALS,
  QUOTATION_COUNTS,
  QUOTATIONS,
  SALES_ALL,
  WAREHOUSES,
} from "./data.js"

/** @param {import('@playwright/test').Page} page */
async function lookups(page) {
  await mockApi(page, "/v1/accounting/customers", { body: pageOf(CUSTOMERS) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
}

/** @param {import('@playwright/test').Page} page */
async function openProposals(page, permissions = SALES_ALL) {
  await mockLoggedIn(page, { permissions })
  await lookups(page)
  const list = await mockApi(page, "/v1/sales/proposals", { method: "GET", body: pageOf(PROPOSALS) })
  await mockApi(page, "/v1/sales/proposals/status-counts", { body: ok(PROPOSAL_COUNTS) })
  await page.goto("/sales/proposals")
  await expect(page.getByText("SP-2026-11-001", { exact: true })).toBeVisible()
  return { list }
}

/** @param {import('@playwright/test').Page} page @param {string} number */
const menu = (page, number) => page.getByRole("button", { name: `Thao tác cho ${number}` })

test("SAL-001 danh sách đề xuất: số đếm tab, tiền, nhãn Hết hạn; lọc tab gửi status @smoke", async ({ page }) => {
  const { list } = await openProposals(page)
  await expect(page.getByRole("tab", { name: "Tất cả (4)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Đã chấp nhận (2)" })).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: "SP-2026-11-002" })
  await expect(row).toContainText("220.000")
  await expect(row).toContainText("Hết hạn") // still SENT past its due date
  await page.getByRole("tab", { name: /Đã gửi/ }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("status")).toBe("SENT")
  await expect(page).toHaveURL(/status=SENT/)
})

test("SAL-002 tạo đề xuất: bắt buộc khách hàng, hạn trước ngày bị chặn (SAL_007), gửi đúng DocumentForm", async ({ page }) => {
  await openProposals(page)
  const create = await mockApi(page, "/v1/sales/proposals", { method: "POST", body: ok(DETAIL) })
  await page.getByRole("button", { name: "Tạo đề xuất" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Ngày đề xuất").fill("2026-11-20")
  await dialog.getByLabel("Hiệu lực đến").fill("2026-11-19")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Hãy chọn khách hàng")).toBeVisible()
  await expect(dialog.getByText("Hạn không được trước ngày chứng từ")).toBeVisible()
  await expect(dialog.getByText("Hãy chọn mặt hàng")).toBeVisible()
  expect(create).toHaveLength(0)

  await dialog.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E O'Brien & Sons" }).click()
  await dialog.getByLabel("Hiệu lực đến").fill("2026-12-20")
  await dialog.getByRole("combobox", { name: "Mặt hàng dòng 1" }).click()
  await page.getByRole("option", { name: "E2E Bàn phím (KB-01)" }).click()
  await dialog.getByLabel("Số lượng dòng 1").fill("2")
  await dialog.getByLabel("Giảm giá % dòng 1").fill("101")
  await expect(dialog.getByText("Giảm giá từ 0 đến 100%")).toBeVisible()
  await dialog.getByLabel("Giảm giá % dòng 1").fill("10")
  // preview: 2 × 100.000 − 10% = 180.000, VAT 10% = 18.000 → 198.000
  await expect(dialog.getByTestId("doc-summary")).toContainText("198.000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    customerId: 6,
    warehouseId: null,
    docDate: "2026-11-20",
    dueDate: "2026-12-20",
    paymentTerms: null,
    notes: null,
    lines: [{ itemId: 12, quantity: 2, discountPct: 10 }],
  })
  await expect(dialog).toBeHidden()
})

test("SAL-003 thao tác theo trạng thái: nháp sửa/gửi/xóa; đã gửi chấp nhận/từ chối; đã chấp nhận chuyển hóa đơn", async ({ page }) => {
  await openProposals(page)
  await menu(page, "SP-2026-11-001").click()
  for (const name of ["Xem", "Sửa", "Gửi", "Xóa"]) await expect(page.getByRole("menuitem", { name })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Chấp nhận" })).toHaveCount(0)
  await page.keyboard.press("Escape")

  await menu(page, "SP-2026-11-002").click()
  await expect(page.getByRole("menuitem", { name: "Chấp nhận" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Sửa" })).toHaveCount(0) // only a draft (SAL_002)
  await page.keyboard.press("Escape")

  // converted once already → only "View Invoice"
  await menu(page, "SP-2026-11-004").click()
  await expect(page.getByRole("menuitem", { name: "Chuyển thành hóa đơn" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Xem hóa đơn" })).toBeVisible()
  await page.keyboard.press("Escape")

  const convert = await mockApi(page, "/v1/sales/proposals/102/convert", {
    body: ok({ document: { id: "302", number: "SI-2026-11-009", status: "DRAFT" } }),
  })
  await menu(page, "SP-2026-11-003").click()
  await page.getByRole("menuitem", { name: "Chuyển thành hóa đơn" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Chuyển thành hóa đơn" }).click()
  await expect(page.getByText("Đã tạo hóa đơn SI-2026-11-009")).toBeVisible()
  expect(convert.requests).toHaveLength(1)
})

test("SAL-004 chỉ có SALES_VIEW: không nút tạo, menu chỉ còn Xem; menu bán hàng theo quyền", async ({ page }) => {
  await openProposals(page, ["SALES_VIEW"])
  await expect(page.getByRole("button", { name: "Tạo đề xuất" })).toHaveCount(0)
  await menu(page, "SP-2026-11-001").click()
  await expect(page.getByRole("menuitem")).toHaveText(["Xem"])
  await page.keyboard.press("Escape")
  const nav = page.getByRole("navigation").or(page.locator("[data-sidebar='sidebar']"))
  await expect(nav.getByRole("link", { name: "Hóa đơn bán hàng" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Báo giá" })).toHaveCount(0) // no QUOTATION_VIEW
})

test("SAL-005 xem chi tiết qua ?view: dòng hàng, thuế, tổng, còn nợ", async ({ page }) => {
  await mockLoggedIn(page, { permissions: SALES_ALL })
  await lookups(page)
  await mockApi(page, "/v1/sales/proposals", { method: "GET", body: pageOf(PROPOSALS) })
  await mockApi(page, "/v1/sales/proposals/status-counts", { body: ok(PROPOSAL_COUNTS) })
  const get = await mockApi(page, "/v1/sales/proposals/100", { body: ok(DETAIL) })
  await page.goto("/sales/proposals?view=100")
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("SP-2026-11-001")
  await expect(dialog).toContainText("E2E Bàn phím")
  await expect(dialog).toContainText("Net 30")
  await expect(dialog).toContainText("E2E giao tại văn phòng")
  await expect(dialog.getByText("Còn nợ")).toBeVisible()
  expect(get.requests).toHaveLength(1)
  await page.keyboard.press("Escape")
  await expect(page).not.toHaveURL(/view=/)
})

test("SAL-006 lỗi nghiệp vụ từ backend (SAL_002) hiện message, danh sách không đổi", async ({ page }) => {
  const { list } = await openProposals(page)
  await mockApi(page, "/v1/sales/proposals/100/send", {
    status: 400,
    body: { result: false, code: "SAL_002", message: "E2E Chỉ chứng từ nháp mới được gửi." },
  })
  const before = list.requests.length
  await menu(page, "SP-2026-11-001").click()
  await page.getByRole("menuitem", { name: "Gửi" }).click()
  await expect(page.getByText("E2E Chỉ chứng từ nháp mới được gửi.")).toBeVisible()
  expect(list.requests.length).toBe(before) // no reload after a failure
})

test("SAL-010 hóa đơn: tab Quá hạn gửi overdue=true; ghi sổ qua xác nhận", async ({ page }) => {
  await mockLoggedIn(page, { permissions: SALES_ALL })
  await lookups(page)
  const list = await mockApi(page, "/v1/sales/invoices", { method: "GET", body: pageOf(INVOICES) })
  await mockApi(page, "/v1/sales/invoices/status-counts", { body: ok(INVOICE_COUNTS) })
  const post = await mockApi(page, "/v1/sales/invoices/300/post", { body: ok({ document: { ...INVOICES[0], status: "POSTED" } }) })
  await page.goto("/sales/invoices")
  await expect(page.getByRole("row").filter({ hasText: "SI-2026-11-002" })).toContainText("Quá hạn")

  await page.getByRole("tab", { name: "Quá hạn" }).click()
  await expect
    .poll(() => {
      const u = list.requests.at(-1)?.url
      return [u?.searchParams.get("overdue"), u?.searchParams.get("status")]
    })
    .toEqual(["true", null])

  await page.getByRole("tab", { name: /^Tất cả/ }).click()
  await menu(page, "SI-2026-11-001").click()
  await expect(page.getByRole("menuitem", { name: "Gửi" })).toHaveCount(0) // invoices are posted, not sent
  await page.getByRole("menuitem", { name: "Ghi sổ" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("không thể sửa hay xóa")
  await page.getByRole("alertdialog").getByRole("button", { name: "Ghi sổ" }).click()
  await expect.poll(() => post.requests.length).toBe(1)
})

test("SAL-011 hóa đơn theo dịch vụ: ẩn kho và số lượng, gửi quantity 1, không warehouseId", async ({ page }) => {
  await mockLoggedIn(page, { permissions: SALES_ALL })
  await lookups(page)
  await mockApi(page, "/v1/sales/invoices", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/sales/invoices/status-counts", { body: ok(INVOICE_COUNTS) })
  const create = await mockApi(page, "/v1/sales/invoices", { method: "POST", body: ok(DETAIL) })
  await page.goto("/sales/invoices")
  await expect(page.getByText("Chưa có hóa đơn")).toBeVisible()
  await page.getByRole("button", { name: "Tạo hóa đơn" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Loại hóa đơn" }).click()
  await page.getByRole("option", { name: "Theo dịch vụ" }).click()
  await expect(dialog.getByRole("combobox", { name: "Kho" })).toHaveCount(0)
  await expect(dialog.getByLabel("Số lượng dòng 1")).toHaveCount(0)
  await dialog.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E Công ty TNHH Ánh Dương" }).click()
  await dialog.getByRole("combobox", { name: "Mặt hàng dòng 1" }).click()
  await expect(page.getByRole("option", { name: /E2E Bàn phím/ })).toHaveCount(0) // services only (SAL_008)
  await page.getByRole("option", { name: "E2E Lắp đặt (SV-01)" }).click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toMatchObject({ invoiceType: "SERVICE", warehouseId: null, customerId: 5, lines: [{ itemId: 13, quantity: 1 }] })
})

test("SAL-020 báo giá: phiên bản v2, nhân bản qua xác nhận, tạo phiên bản mới", async ({ page }) => {
  await mockLoggedIn(page, { permissions: SALES_ALL })
  await lookups(page)
  await mockApi(page, "/v1/sales/quotations", { method: "GET", body: pageOf(QUOTATIONS) })
  await mockApi(page, "/v1/sales/quotations/status-counts", { body: ok(QUOTATION_COUNTS) })
  const dup = await mockApi(page, "/v1/sales/quotations/201/duplicate", { body: ok(DETAIL) })
  const ver = await mockApi(page, "/v1/sales/quotations/201/versions", { body: ok(DETAIL) })
  await page.goto("/sales/quotations")
  await expect(page.getByRole("row").filter({ hasText: "QT-2026-11-001" })).toContainText("v2")

  await menu(page, "QT-2026-11-002").click()
  await expect(page.getByRole("menuitem", { name: "Chấp nhận" })).toHaveCount(0) // rejected
  await page.getByRole("menuitem", { name: "Nhân bản" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Nhân bản" }).click()
  await expect.poll(() => dup.requests.length).toBe(1)

  await menu(page, "QT-2026-11-002").click()
  await page.getByRole("menuitem", { name: "Tạo phiên bản mới" }).click()
  await expect.poll(() => ver.requests.length).toBe(1)
})

test("SAL-030 chưa đăng nhập → về /login?redirect=", async ({ page }) => {
  await page.goto("/sales/invoices")
  await expect(page).toHaveURL(/\/login\?redirect=%2Fsales%2Finvoices/)
})
