// @ts-check
/**
 * POS (manual §10): checkout, payment, receipt, orders, barcodes, reports.
 * Spec sources: commerce-service PosController / PosService (CartForm {customerId?, warehouseId, bankAccountId,
 * discount, lines}, POST /pos/orders/preview and /pos/orders, GET /pos/orders(/{id}(/pdf)), POST /pos/barcodes/pdf ≤ 300
 * labels), PosReportService; POS_003 (bank account before payment), POS_005 (discount), POS_007 (period); permissions
 * POS_SELL / POS_VIEW / POS_REPORT. PDFs come through request(…, { as: "blob" }).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["POS_SELL", "POS_VIEW", "POS_REPORT"]
const ITEMS = [
  { id: "601", type: "PRODUCT", name: "E2E Keyboard", sku: "KB-01", categoryId: "1", salePrice: 1200000, quantity: 3 },
  { id: "602", type: "PRODUCT", name: "E2E Mouse", sku: "MS-01", categoryId: "2", salePrice: 350000, quantity: 0 },
  { id: "603", type: "SERVICE", name: "E2E Setup", sku: "SV-01", categoryId: "2", salePrice: 500000, quantity: 0 },
]
const CATEGORIES = [
  { id: "1", name: "E2E Devices" },
  { id: "2", name: "E2E Other" },
]
const WAREHOUSES = [{ id: "801", name: "E2E Kho Hà Nội", active: true }]
const STOCK = [
  { itemId: "601", warehouseId: "801", quantity: 2 },
  { itemId: "602", warehouseId: "801", quantity: 0 },
]
const BANKS = [{ id: "11", holderName: "E2E Cash", bankName: "E2E Counter", accountNumber: "0001", active: true }]
const PREVIEW = {
  customerName: "Walk-in Customer",
  warehouseName: "E2E Kho Hà Nội",
  subtotal: 2400000,
  taxes: [{ name: "E2E VAT", rate: 10, amount: 240000 }],
  taxTotal: 240000,
  discount: 0,
  total: 2640000,
  lines: [{ itemId: "601", itemName: "E2E Keyboard", sku: "KB-01", quantity: 2, unitPrice: 1200000, taxRate: 10, taxAmount: 240000, amount: 2400000 }],
}
const ORDER = {
  order: {
    id: "71",
    number: "POS-2026-11-001",
    receiptNumber: "RCPT-2026-11-001",
    orderDate: "2026-11-22",
    customerName: "Walk-in Customer",
    warehouseName: "E2E Kho Hà Nội",
    items: 1,
    total: 2640000,
  },
  bankAccountName: "E2E Counter - 0001",
  subtotal: 2400000,
  taxes: PREVIEW.taxes,
  taxTotal: 240000,
  discount: 0,
  lines: PREVIEW.lines,
}

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function openPos(page, permissions = ALL) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/categories", { body: ok(CATEGORIES) })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf([{ id: "501", companyName: "E2E O'Brien & Sons" }]) })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  await mockApi(page, "/v1/accounting/bank-accounts", { body: pageOf(BANKS) })
  await mockApi(page, "/v1/inventory/stock", { body: ok(STOCK) })
  const preview = await mockApi(page, "/v1/pos/orders/preview", { method: "POST", body: ok(PREVIEW) })
  await page.goto("/pos")
  await expect(page.getByRole("button", { name: "Thêm E2E Keyboard vào giỏ" })).toBeVisible()
  return preview
}

test("POS-001 lưới sản phẩm: tồn theo kho, hết hàng bị khóa, lọc danh mục và tìm kiếm @smoke", async ({ page }) => {
  await openPos(page)
  await expect(page.getByRole("button", { name: "Thêm E2E Keyboard vào giỏ" })).toContainText("Tồn: 2")
  await expect(page.getByRole("button", { name: "Thêm E2E Mouse vào giỏ" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Thêm E2E Setup vào giỏ" })).toBeEnabled() // a service has no stock
  await page.getByRole("tab", { name: "E2E Devices" }).click()
  await expect(page.getByRole("button", { name: "Thêm E2E Setup vào giỏ" })).toHaveCount(0)
  await page.getByRole("tab", { name: "Tất cả" }).click()
  await page.getByLabel("Tìm kiếm").fill("ms-01")
  await expect(page.getByRole("button", { name: /vào giỏ/ })).toHaveCount(1)
})

test("POS-002 giỏ hàng: +/− theo tồn kho, tổng tiền từ preview, gửi CartForm khách vãng lai", async ({ page }) => {
  const preview = await openPos(page)
  await page.getByRole("button", { name: "Thêm E2E Keyboard vào giỏ" }).click()
  await page.getByRole("button", { name: "Thêm 1 E2E Keyboard" }).click()
  await expect(page.getByRole("button", { name: "Thêm 1 E2E Keyboard" })).toBeDisabled() // only 2 in stock
  await expect(page.getByTestId("pos-totals")).toContainText("2.640.000")
  await expect(page.getByTestId("pos-totals")).toContainText("E2E VAT (10%)")
  await expect.poll(() => preview.at(-1)).toEqual({
    customerId: null,
    warehouseId: 801,
    bankAccountId: null,
    discount: 0,
    lines: [{ itemId: 601, quantity: 2 }],
  })
  await page.getByLabel("Giảm giá (số tiền)").fill("40000")
  await expect.poll(() => /** @type {any} */ (preview.at(-1))?.discount).toBe(40000)
  await page.getByRole("button", { name: "Bỏ E2E Keyboard" }).click()
  await expect(page.getByText("Giỏ hàng trống")).toBeVisible()
  await expect(page.getByRole("button", { name: "Thanh toán", exact: true })).toBeDisabled()
})

test("POS-003 lỗi preview (POS_005 giảm giá quá tổng) hiện message, không cho thanh toán", async ({ page }) => {
  await openPos(page)
  await mockApi(page, "/v1/pos/orders/preview", {
    method: "POST",
    status: 400,
    body: fail("POS_005", "Giảm giá không được lớn hơn tạm tính cộng thuế."),
  })
  await page.getByRole("button", { name: "Thêm E2E Keyboard vào giỏ" }).click()
  await page.getByLabel("Giảm giá (số tiền)").fill("99999999")
  await expect(page.getByText("Giảm giá không được lớn hơn tạm tính cộng thuế.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Thanh toán", exact: true })).toBeDisabled()
})

test("POS-004 thanh toán: phải chọn tài khoản ngân hàng (POS_003), gửi CartForm, hiện biên nhận và tải PDF", async ({ page }) => {
  await openPos(page)
  const create = await mockApi(page, "/v1/pos/orders", { method: "POST", body: ok(ORDER) })
  await page.route(/\/api\/v1\/pos\/orders\/71\/pdf$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4 e2e") })
  )
  await page.getByRole("button", { name: "Thêm E2E Keyboard vào giỏ" }).click()
  await page.getByRole("button", { name: "Thêm 1 E2E Keyboard" }).click()
  await page.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E O'Brien & Sons" }).click()
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByTestId("pos-receipt")).toContainText("E2E Keyboard")
  const pay = dialog.getByRole("button", { name: /Thanh toán 2\.640\.000/ })
  await expect(pay).toBeDisabled()
  await dialog.getByRole("combobox", { name: "Tài khoản ngân hàng" }).click()
  await page.getByRole("option", { name: /E2E Counter/ }).click()
  await pay.click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ customerId: 501, warehouseId: 801, bankAccountId: 11, discount: 0, lines: [{ itemId: 601, quantity: 2 }] })

  const receipt = page.getByRole("dialog")
  await expect(receipt.getByRole("heading", { name: "Đã thanh toán — biên nhận RCPT-2026-11-001" })).toBeVisible()
  await expect(receipt).toContainText("E2E Counter - 0001")
  const download = page.waitForEvent("download")
  await receipt.getByRole("button", { name: "Tải PDF" }).click()
  expect((await download).suggestedFilename()).toBe("RCPT-2026-11-001.pdf")
})

test("POS-010 đơn POS: danh sách, chi tiết qua ?view= có thuế; tải PDF lỗi hiện message", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  const list = await mockApi(page, "/v1/pos/orders", { method: "GET", body: pageOf([ORDER.order]) })
  await mockApi(page, "/v1/pos/orders/71", { method: "GET", body: ok(ORDER) })
  await mockApi(page, "/v1/pos/orders/71/pdf", { status: 404, body: fail("POS_001", "Đơn POS không tồn tại.") })
  await page.goto("/pos/orders")
  const row = page.getByRole("row").filter({ hasText: "POS-2026-11-001" })
  await expect(row).toContainText("RCPT-2026-11-001")
  await expect(row).toContainText("2.640.000")
  await page.getByLabel("Tìm kiếm").fill("RCPT")
  await page.getByRole("button", { name: "Tìm kiếm" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("keyword")).toBe("RCPT")
  await page.getByRole("button", { name: "Xem POS-2026-11-001" }).click()
  await expect(page).toHaveURL(/view=71/)
  await expect(page.getByRole("dialog")).toContainText("E2E VAT (10%)")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Tải PDF của POS-2026-11-001" }).click()
  await expect(page.getByText("Đơn POS không tồn tại.")).toBeVisible()
})

test("POS-020 mã vạch: chỉ sản phẩm còn tồn ở kho, tổng nhãn ≤ 300, gửi BarcodeForm và tải PDF", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/stock", { body: ok(STOCK) })
  /** @type {unknown[]} */
  const sent = []
  await page.route(/\/api\/v1\/pos\/barcodes\/pdf$/, (route) => {
    sent.push(route.request().postDataJSON())
    return route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4 e2e") })
  })
  await page.goto("/pos/barcodes")
  await page.getByRole("combobox", { name: "Kho" }).click()
  await page.getByRole("option", { name: "E2E Kho Hà Nội" }).click()
  await expect(page.getByRole("button", { name: "Thêm nhãn cho E2E Mouse" })).toHaveCount(0) // no stock
  await page.getByRole("button", { name: "Thêm nhãn cho E2E Keyboard" }).click()
  await page.getByLabel("Số nhãn của E2E Keyboard").fill("301")
  await expect(page.getByText("301 trên tối đa 300 nhãn")).toBeVisible()
  await expect(page.getByRole("button", { name: "Tải PDF" })).toBeDisabled()
  await page.getByLabel("Số nhãn của E2E Keyboard").fill("12")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Tải PDF" }).click()
  expect((await download).suggestedFilename()).toBe("barcodes.pdf")
  expect(sent[0]).toEqual({ warehouseId: 801, items: [{ itemId: 601, copies: 12 }] })
})

test("POS-030 báo cáo: tổng doanh số, theo kho, top khách hàng; đổi khoảng ngày gửi from/to", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  const sales = await mockApi(page, "/v1/pos/reports/sales", {
    body: ok({ orders: 3, total: 5000000, daily: [], monthly: [], byWarehouse: [{ warehouseId: "801", warehouseName: "E2E Kho Hà Nội", orders: 3, total: 5000000 }] }),
  })
  await mockApi(page, "/v1/pos/reports/products", { body: ok({ totalQuantity: 0, top10: [], all: [] }) })
  await mockApi(page, "/v1/pos/reports/customers", {
    body: ok({ top10: [{ customerId: null, customerName: null, orders: 3, spent: 5000000, averageOrderValue: 1666667, lastOrderDate: "2026-11-22" }], all: [] }),
  })
  await page.goto("/pos/reports")
  await expect(page.getByText("5.000.000").first()).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "E2E Kho Hà Nội" })).toContainText("3")
  await page.getByRole("tab", { name: "Khách hàng" }).click()
  await expect(page.getByRole("row").filter({ hasText: "Khách vãng lai" })).toContainText("1.666.667")
  await page.getByLabel("Từ ngày").fill("2026-01-01")
  await expect.poll(() => sales.requests.at(-1)?.url.searchParams.get("from")).toBe("2026-01-01")
})

test("POS-040 chỉ POS_VIEW: menu chỉ có Đơn POS", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["POS_VIEW"] })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  await mockApi(page, "/v1/pos/orders", { method: "GET", body: pageOf([]) })
  await page.goto("/pos/orders")
  await expect(page.getByText("Chưa có đơn POS")).toBeVisible()
  const nav = page.locator("[data-sidebar=content]")
  await expect(nav.getByRole("link", { name: "Đơn POS" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Bán hàng (POS)" })).toHaveCount(0)
  await expect(nav.getByRole("link", { name: "Mã vạch" })).toHaveCount(0)
  await expect(nav.getByRole("link", { name: "Báo cáo POS" })).toHaveCount(0)
})

// GET /pos/orders?customerId= (PosController); customers from /accounting/customers; walk-in orders have no customer
test("POS-011 đơn POS: lọc theo khách hàng gửi customerId và giữ trên URL", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf([{ id: "501", customerCode: "E2E-C1", companyName: "E2E Công ty Ánh Dương" }]) })
  const list = await mockApi(page, "/v1/pos/orders", { method: "GET", body: pageOf([ORDER.order]) })
  await page.goto("/pos/orders")
  await expect(page.getByRole("row").filter({ hasText: "POS-2026-11-001" })).toBeVisible()
  expect(list.requests[0].url.searchParams.get("customerId")).toBeNull()
  await page.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E Công ty Ánh Dương" }).click()
  await expect(page).toHaveURL(/customerId=501/)
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("customerId")).toBe("501")
  await page.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "Tất cả khách hàng" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("customerId")).toBeNull()
})

test("POS-005 thêm vào giỏ theo SKU: Enter thêm đúng sản phẩm (không phân biệt hoa thường), sai SKU hoặc hết tồn thì báo", async ({ page }) => {
  const preview = await openPos(page)
  const sku = page.getByLabel(/Thêm vào giỏ theo SKU/)
  await sku.fill("kb-01")
  await sku.press("Enter")
  await expect(sku).toHaveValue("") // cleared for the next scan
  await expect.poll(() => /** @type {any} */ (preview.at(-1))?.lines).toEqual([{ itemId: 601, quantity: 1 }])
  await sku.fill("KB-01")
  await sku.press("Enter")
  await expect.poll(() => /** @type {any} */ (preview.at(-1))?.lines).toEqual([{ itemId: 601, quantity: 2 }])
  await sku.fill("KB-01")
  await sku.press("Enter")
  await expect(page.getByText("E2E Keyboard đã hết tồn ở kho này")).toBeVisible() // only 2 in stock
  await expect(sku).toHaveValue("KB-01")
  await sku.fill("NOPE-9")
  await sku.press("Enter")
  await expect(page.getByText("Không có sản phẩm có SKU NOPE-9")).toBeVisible()
})

test("POS-006 SKU ngoài 100 sản phẩm đã tải: hỏi backend theo keyword rồi thêm vào giỏ", async ({ page }) => {
  const preview = await openPos(page)
  const extra = { id: "699", type: "SERVICE", name: "E2E Late Service", sku: "LATE-99", categoryId: "2", salePrice: 90000, quantity: 0 }
  const search = await mockApi(page, "/v1/inventory/items", { body: pageOf([extra]) })
  const sku = page.getByLabel(/Thêm vào giỏ theo SKU/)
  await sku.fill("late-99")
  await sku.press("Enter")
  await expect(sku).toHaveValue("")
  expect(search.requests[0].url.searchParams.get("keyword")).toBe("late-99")
  await expect.poll(() => /** @type {any} */ (preview.at(-1))?.lines).toEqual([{ itemId: 699, quantity: 1 }])
  await expect(page.getByRole("button", { name: "Bỏ E2E Late Service" })).toBeVisible() // cart line resolves the item
})
