// @ts-check
/**
 * Products & services (manual §9): items list, 4-step create, edit, Add Stock, setup.
 * Spec sources: inventory-service ItemController / ItemService (ItemCreateForm {type, name, sku | generateSku, taxId,
 * categoryId, unitId, salePrice, purchasePrice, shortDescription, description, openingWarehouseId, openingQuantity},
 * ItemUpdateForm), ItemImageService (PUT /items/{id}/images), StockController POST /stock/add, CatalogController
 * (categories, taxes 0..100, units); INV_006 (still used), INV_011 (SKU), INV_018 (opening stock).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["INVENTORY_VIEW", "INVENTORY_MANAGE"]
const CATEGORIES = [{ id: "1", name: "E2E Devices", color: "#2563eb" }]
const TAXES = [{ id: "2", name: "E2E VAT", rate: 10 }]
const UNITS = [{ id: "3", name: "E2E Piece" }]
const WAREHOUSES = [
  { id: "801", name: "E2E Kho Hà Nội", active: true },
  { id: "802", name: "E2E Kho cũ", active: false },
]
const ITEMS = [
  {
    id: "601",
    type: "PRODUCT",
    name: "E2E Keyboard",
    sku: "KB-01",
    taxId: "2",
    categoryId: "1",
    categoryName: "E2E Devices",
    unitId: "3",
    unitName: "E2E Piece",
    salePrice: 1200000,
    purchasePrice: 800000,
    quantity: 67,
    mainImageId: null,
  },
  { id: "602", type: "SERVICE", name: "E2E Setup", sku: "SV-01", categoryId: "1", categoryName: "E2E Devices", unitId: "3", unitName: "E2E Piece", salePrice: 500000, purchasePrice: 0, quantity: 0 },
]

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function openItems(page, permissions = ALL) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/inventory/categories", { method: "GET", body: ok(CATEGORIES) })
  await mockApi(page, "/v1/inventory/taxes", { method: "GET", body: ok(TAXES) })
  await mockApi(page, "/v1/inventory/units", { method: "GET", body: ok(UNITS) })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  const list = await mockApi(page, "/v1/inventory/items", { method: "GET", body: pageOf(ITEMS) })
  await page.goto("/inventory/items")
  await expect(page.getByText("E2E Keyboard")).toBeVisible()
  return list
}

/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("PRD-001 danh sách: giá, danh mục, đơn vị, SL (dịch vụ không có SL), loại; lọc loại và danh mục @smoke", async ({ page }) => {
  const list = await openItems(page)
  const kb = page.getByRole("row").filter({ hasText: "E2E Keyboard" })
  await expect(kb).toContainText("KB-01")
  await expect(kb).toContainText("1.200.000")
  await expect(kb).toContainText("800.000")
  await expect(kb).toContainText("E2E Piece")
  await expect(kb).toContainText("67")
  const sv = page.getByRole("row").filter({ hasText: "E2E Setup" })
  await expect(sv).toContainText("Dịch vụ")
  await page.getByRole("combobox", { name: "Loại mặt hàng" }).click()
  await page.getByRole("option", { name: "Dịch vụ" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("type")).toBe("SERVICE")
  await page.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Devices" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("categoryId")).toBe("1")
})

test("PRD-002 tạo mặt hàng 4 bước: mỗi bước chặn khi thiếu, tự sinh SKU, tồn đầu kỳ cần kho (INV_018), gửi đúng ItemCreateForm", async ({ page }) => {
  await openItems(page)
  const create = await mockApi(page, "/v1/inventory/items", { method: "POST", body: ok({ ...ITEMS[0], id: "603" }) })
  const images = await mockApi(page, "/v1/inventory/items/603/images", { method: "PUT", body: ok({}) })
  await page.getByRole("button", { name: "Tạo mặt hàng" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Bước 1/4: Thông tin cơ bản")).toBeVisible()
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByText("Nhập SKU hoặc chọn Tự sinh SKU")).toBeVisible()
  await expect(dialog.getByText("Hãy chọn danh mục")).toBeVisible()

  await dialog.getByLabel("Tên").fill("E2E HDMI cable")
  await dialog.getByRole("checkbox", { name: "Tự sinh SKU" }).click()
  await expect(dialog.getByLabel("SKU", { exact: true })).toBeDisabled()
  await dialog.getByRole("combobox", { name: "Thuế" }).click()
  await page.getByRole("option", { name: "E2E VAT (10%)" }).click()
  await dialog.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Devices" }).click()
  await dialog.getByRole("button", { name: "Tiếp" }).click()

  await expect(dialog.getByText("Bước 2/4: Giá và đơn vị")).toBeVisible()
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByText("Hãy chọn đơn vị")).toBeVisible()
  await dialog.getByLabel("Giá bán").fill("150000")
  await dialog.getByLabel("Giá mua").fill("90000")
  await dialog.getByRole("combobox", { name: "Đơn vị" }).click()
  await page.getByRole("option", { name: "E2E Piece" }).click()
  await dialog.getByLabel("Số lượng đầu kỳ").fill("20")
  await dialog.getByRole("button", { name: "Tiếp" }).click()

  await expect(dialog.getByText("Bước 3/4: Hình ảnh")).toBeVisible()
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByText("Bước 4/4: Kho")).toBeVisible()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Hãy chọn kho")).toBeVisible() // INV_018
  expect(create).toHaveLength(0)
  await dialog.getByRole("combobox", { name: "Kho" }).click()
  await expect(page.getByRole("option", { name: "E2E Kho cũ" })).toHaveCount(0) // inactive (INV_015)
  await page.getByRole("option", { name: "E2E Kho Hà Nội" }).click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    type: "PRODUCT",
    name: "E2E HDMI cable",
    taxId: 2,
    categoryId: 1,
    unitId: 3,
    salePrice: 150000,
    purchasePrice: 90000,
    shortDescription: null,
    description: null,
    generateSku: true,
    openingWarehouseId: 801,
    openingQuantity: 20,
  })
  expect(images).toHaveLength(0) // no image chosen → no images call
})

test("PRD-003 dịch vụ chỉ 3 bước, không có tồn đầu kỳ", async ({ page }) => {
  await openItems(page)
  const create = await mockApi(page, "/v1/inventory/items", { method: "POST", body: ok(ITEMS[1]) })
  await page.getByRole("button", { name: "Tạo mặt hàng" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Loại mặt hàng" }).click()
  await page.getByRole("option", { name: "Dịch vụ" }).click()
  await dialog.getByLabel("Tên").fill("E2E Install")
  await dialog.getByLabel("SKU", { exact: true }).fill("SV-02")
  await dialog.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Devices" }).click()
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByText("Bước 2/3: Giá và đơn vị")).toBeVisible()
  await expect(dialog.getByLabel("Số lượng đầu kỳ")).toHaveCount(0)
  await dialog.getByLabel("Giá bán").fill("500000")
  await dialog.getByLabel("Giá mua").fill("0")
  await dialog.getByRole("combobox", { name: "Đơn vị" }).click()
  await page.getByRole("option", { name: "E2E Piece" }).click()
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toMatchObject({ type: "SERVICE", sku: "SV-02", taxId: null })
  expect(create[0]).not.toHaveProperty("openingWarehouseId")
})

test("PRD-004 sửa: PUT thay thế toàn bộ với SKU, ảnh cũ được tải, không có tồn đầu kỳ", async ({ page }) => {
  await openItems(page)
  await mockApi(page, "/v1/inventory/items/601", { method: "GET", body: ok(ITEMS[0]) })
  await mockApi(page, "/v1/inventory/items/601/images", { method: "GET", body: ok({ itemId: "601", mainImageId: null, additionalImageIds: [] }) })
  const update = await mockApi(page, "/v1/inventory/items/601", { method: "PUT", body: ok(ITEMS[0]) })
  await menu(page, "E2E Keyboard").click()
  await page.getByRole("menuitem", { name: "Sửa" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("SKU", { exact: true })).toHaveValue("KB-01")
  await expect(dialog.getByRole("checkbox", { name: "Tự sinh SKU" })).toHaveCount(0)
  await dialog.getByLabel("Tên").fill("E2E Keyboard Pro")
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByLabel("Số lượng đầu kỳ")).toHaveCount(0)
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByText("Bước 3/3: Hình ảnh")).toBeVisible()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => update.length).toBe(1)
  expect(update[0]).toEqual({
    type: "PRODUCT",
    name: "E2E Keyboard Pro",
    sku: "KB-01",
    taxId: 2,
    categoryId: 1,
    unitId: 3,
    salePrice: 1200000,
    purchasePrice: 800000,
    shortDescription: null,
    description: null,
  })
})

test("PRD-005 thêm tồn kho: tên/SKU chỉ đọc, gửi AddStockForm; dịch vụ không có Thêm tồn kho", async ({ page }) => {
  await openItems(page)
  const add = await mockApi(page, "/v1/inventory/stock/add", { method: "POST", body: ok({ quantity: 72 }) })
  await menu(page, "E2E Setup").click()
  await expect(page.getByRole("menuitem", { name: "Thêm tồn kho" })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await menu(page, "E2E Keyboard").click()
  await page.getByRole("menuitem", { name: "Thêm tồn kho" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("SKU", { exact: true })).toHaveValue("KB-01")
  await expect(dialog.getByLabel("SKU", { exact: true })).toHaveAttribute("readonly", "")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Hãy chọn kho")).toBeVisible()
  await dialog.getByRole("combobox", { name: "Kho" }).click()
  await page.getByRole("option", { name: "E2E Kho Hà Nội" }).click()
  await dialog.getByLabel("SL").fill("5")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => add.length).toBe(1)
  expect(add[0]).toEqual({ itemId: 601, warehouseId: 801, quantity: 5 })
})

test("PRD-006 chỉ INVENTORY_VIEW: không tạo, không menu thao tác", async ({ page }) => {
  await openItems(page, ["INVENTORY_VIEW"])
  await expect(page.getByRole("button", { name: "Tạo mặt hàng" })).toHaveCount(0)
  await expect(menu(page, "E2E Keyboard")).toHaveCount(0)
})

test("PRD-010 thiết lập: thuế suất 0..100, gửi TaxForm; xóa danh mục đang dùng hiện INV_006", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/inventory/categories", { method: "GET", body: ok(CATEGORIES) })
  await mockApi(page, "/v1/inventory/taxes", { method: "GET", body: ok(TAXES) })
  await mockApi(page, "/v1/inventory/categories/1", {
    method: "DELETE",
    status: 400,
    body: fail("INV_006", "Mục này vẫn được mặt hàng sử dụng nên không thể xóa."),
  })
  const tax = await mockApi(page, "/v1/inventory/taxes", { method: "POST", body: ok({ id: "4" }) })
  await page.goto("/inventory/setup")
  await expect(page.getByRole("row").filter({ hasText: "E2E Devices" })).toContainText("#2563eb")
  await page.getByRole("button", { name: "Xóa E2E Devices" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
  await expect(page.getByText("Mục này vẫn được mặt hàng sử dụng nên không thể xóa.")).toBeVisible()

  await page.getByRole("tab", { name: "Thuế" }).click()
  await expect(page).toHaveURL(/tab=taxes/)
  await expect(page.getByRole("row").filter({ hasText: "E2E VAT" })).toContainText("10%")
  await page.getByRole("button", { name: "Tạo thuế" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên").fill("E2E VAT 8")
  await dialog.getByLabel("Thuế suất (%)").fill("101")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Nhập thuế suất từ 0 đến 100")).toBeVisible()
  expect(tax).toHaveLength(0)
  await dialog.getByLabel("Thuế suất (%)").fill("8")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => tax.length).toBe(1)
  expect(tax[0]).toEqual({ name: "E2E VAT 8", rate: 8 })
})
