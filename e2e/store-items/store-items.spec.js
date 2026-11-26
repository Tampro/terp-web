// @ts-check
/**
 * Store items: price and on-sale status per store (/inventory/store-items).
 * Spec sources: inventory-service StoreItemController / StoreItemService (StoreItemForm {warehouseId, itemId, salePrice,
 * status, purchaseLimitQty}, StoreItemUpdateForm = full replacement, StatusForm, BulkForm ≤ 1000 lines, StoreItemDto);
 * INV_026 (already set up), INV_027 (not found), INV_028 (bulk row n: reason), INV_029 (too many lines).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["INVENTORY_VIEW", "INVENTORY_MANAGE"]
const WAREHOUSES = [
  { id: "801", name: "E2E Store One", active: true },
  { id: "802", name: "E2E Store Two", active: true },
]
const CATEGORIES = [{ id: "1", name: "E2E Fresh", color: "#43A047" }]
const ITEMS = [
  { id: "601", type: "PRODUCT", name: "E2E Egg 20", sku: "EGG-20", salePrice: 5990 },
  { id: "602", type: "SERVICE", name: "E2E Delivery", sku: "SV-01", salePrice: 3000 },
]
const ROWS = [
  { id: "11", warehouseId: "801", itemId: "601", itemName: "E2E Egg 20", sku: "EGG-20", salePrice: 5990, status: "ON_SALE", purchaseLimitQty: 10, stockQuantity: 4 },
  { id: "12", warehouseId: "801", itemId: "603", itemName: "E2E Milk", sku: "MILK-1", salePrice: 2500, status: "SUSPENDED", purchaseLimitQty: null, stockQuantity: 0 },
]

/** @param {import('@playwright/test').Page} page @param {{ permissions?: string[], url?: string }} [o] */
async function open(page, { permissions = ALL, url = "/inventory/store-items" } = {}) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/inventory/warehouses", { method: "GET", body: pageOf(WAREHOUSES) })
  await mockApi(page, "/v1/inventory/categories", { method: "GET", body: ok(CATEGORIES) })
  await mockApi(page, "/v1/inventory/items", { method: "GET", body: pageOf(ITEMS) })
  const list = await mockApi(page, "/v1/inventory/store-items", { method: "GET", body: pageOf(ROWS) })
  await page.goto(url)
  return list
}

/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("SI-001 menu Kho có 'Hàng theo cửa hàng' khi có INVENTORY_VIEW, ẩn khi không có @smoke", async ({ page }) => {
  await open(page)
  await expect(page.getByRole("link", { name: "Hàng theo cửa hàng" })).toBeVisible()
  const other = await page.context().newPage()
  await mockLoggedIn(other, { permissions: ["SALES_VIEW"] })
  await mockApi(other, "/v1/reports/dashboard", { body: ok({}) })
  await other.goto("/dashboard")
  await expect(other.getByRole("link", { name: "Hàng theo cửa hàng" })).toHaveCount(0)
})

test("SI-002 chưa chọn cửa hàng: hiện lời nhắc, không gọi /store-items; chọn cửa hàng → danh sách, lọc trên URL", async ({ page }) => {
  const list = await open(page)
  await expect(page.getByText("Chọn một cửa hàng để xem các món đang bán.")).toBeVisible()
  expect(list.requests).toHaveLength(0)
  await page.getByRole("combobox", { name: "Cửa hàng" }).click()
  await page.getByRole("option", { name: "E2E Store One" }).click()
  await expect(page).toHaveURL(/warehouseId=801/)
  const egg = page.getByRole("row").filter({ hasText: "E2E Egg 20" })
  await expect(egg).toContainText("EGG-20")
  await expect(egg).toContainText("5.990")
  await expect(egg).toContainText("Đang bán")
  await expect(egg).toContainText("10")
  await expect(page.getByRole("row").filter({ hasText: "E2E Milk" })).toContainText("Tạm ngưng")
  expect(list.requests.at(-1)?.url.searchParams.get("warehouseId")).toBe("801")
  await page.getByRole("combobox", { name: "Trạng thái" }).click()
  await page.getByRole("option", { name: "Tạm ngưng" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("status")).toBe("SUSPENDED")
  await page.getByLabel("Tìm kiếm").fill("egg")
  await page.getByRole("button", { name: "Tìm kiếm" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("keyword")).toBe("egg")
  await expect(page).toHaveURL(/status=SUSPENDED/)
})

test("SI-003 thêm món: chỉ món có tồn kho, giá điền sẵn, gửi StoreItemForm; INV_026 giữ dialog và hiện thông báo backend", async ({ page }) => {
  await open(page, { url: "/inventory/store-items?warehouseId=801" })
  const create = await mockApi(page, "/v1/inventory/store-items", {
    method: "POST",
    status: 400,
    body: fail("INV_026", "Mặt hàng này đã được thiết lập cho cửa hàng."),
  })
  await page.getByRole("button", { name: "Thêm món" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog.getByText("Chọn một món")).toBeVisible()
  await dialog.getByRole("combobox", { name: "Món hàng" }).click()
  await expect(page.getByRole("option", { name: /E2E Delivery/ })).toHaveCount(0)
  await page.getByRole("option", { name: /E2E Egg 20/ }).click()
  await expect(dialog.getByLabel("Giá bán")).toHaveValue("5990")
  await dialog.getByLabel("Tối đa mỗi đơn").fill("10")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ warehouseId: 801, itemId: 601, salePrice: 5990, status: "ON_SALE", purchaseLimitQty: 10 })
  await expect(page.getByText("Mặt hàng này đã được thiết lập cho cửa hàng.")).toBeVisible()
  await expect(dialog).toBeVisible()
})

test("SI-004 sửa: thay toàn bộ giá/trạng thái/giới hạn, xoá giới hạn gửi null; giới hạn 0 bị chặn ở client", async ({ page }) => {
  await open(page, { url: "/inventory/store-items?warehouseId=801" })
  const put = await mockApi(page, "/v1/inventory/store-items/11", { method: "PUT", body: ok({ ...ROWS[0], salePrice: 5490 }) })
  await menu(page, "E2E Egg 20").click()
  await page.getByRole("menuitem", { name: "Sửa" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("Giá bán")).toHaveValue("5990")
  await dialog.getByLabel("Tối đa mỗi đơn").fill("0")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog.getByText("Nhập số nguyên từ 1 trở lên, hoặc để trống")).toBeVisible()
  expect(put).toHaveLength(0)
  await dialog.getByLabel("Tối đa mỗi đơn").fill("")
  await dialog.getByLabel("Giá bán").fill("5490")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ salePrice: 5490, status: "ON_SALE", purchaseLimitQty: null })
})

test("SI-005 tạm ngưng / mở bán qua PUT /status; xoá qua xác nhận, huỷ thì không gọi", async ({ page }) => {
  await open(page, { url: "/inventory/store-items?warehouseId=801" })
  const status = await mockApi(page, "/v1/inventory/store-items/11/status", { method: "PUT", body: ok({ ...ROWS[0], status: "SUSPENDED" }) })
  const del = await mockApi(page, "/v1/inventory/store-items/12", { method: "DELETE", body: ok(null) })
  await menu(page, "E2E Egg 20").click()
  await page.getByRole("menuitem", { name: "Tạm ngưng" }).click()
  await expect.poll(() => status.length).toBe(1)
  expect(status[0]).toEqual({ status: "SUSPENDED" })
  await menu(page, "E2E Milk").click()
  await page.getByRole("menuitem", { name: "Xóa" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Hủy" }).click()
  expect(del).toHaveLength(0)
  await menu(page, "E2E Milk").click()
  await page.getByRole("menuitem", { name: "Xóa" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
  await expect.poll(() => del.length).toBe(1)
})

test("SI-006 chỉ có INVENTORY_VIEW: thấy danh sách, không có nút Thêm / Nhập CSV / thao tác dòng", async ({ page }) => {
  await open(page, { permissions: ["INVENTORY_VIEW"], url: "/inventory/store-items?warehouseId=801" })
  await expect(page.getByRole("row").filter({ hasText: "E2E Egg 20" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Thêm món" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Nhập CSV" })).toHaveCount(0)
  await expect(menu(page, "E2E Egg 20")).toHaveCount(0)
})

test("SI-007 nhập CSV: chặn dòng thiếu SKU ở client, hiện INV_028 của backend, thành công báo số tạo / cập nhật", async ({ page }) => {
  await open(page, { url: "/inventory/store-items?warehouseId=801" })
  await page.getByRole("button", { name: "Nhập CSV" }).click()
  const dialog = page.getByRole("dialog")
  const file = dialog.getByLabel("File CSV")
  const csv = (/** @type {string} */ text) => ({ name: "items.csv", mimeType: "text/csv", buffer: Buffer.from(text) })

  await file.setInputFiles(csv("sku,salePrice\nEGG-20,5990\nMILK-1,2500\n,100\n"))
  await expect(dialog.getByText("Dòng 3: SKU đang trống")).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Nhập", exact: true })).toBeDisabled()

  const bulkFail = await mockApi(page, "/v1/inventory/store-items/bulk", {
    method: "POST",
    status: 400,
    body: fail("INV_028", "Dòng 2 của lô: INV_020"),
  })
  await file.setInputFiles(csv("﻿sku,salePrice,status,purchaseLimitQty\nEGG-20,5990,ON_SALE,10\nNOPE-1,100,,\n"))
  await expect(dialog.getByText("2 dòng sẵn sàng để nhập")).toBeVisible()
  await dialog.getByRole("button", { name: "Nhập", exact: true }).click()
  await expect(dialog.getByText("Dòng 2 của lô: INV_020")).toBeVisible()
  expect(bulkFail[0]).toEqual({
    lines: [
      { warehouseId: 801, sku: "EGG-20", salePrice: 5990, status: "ON_SALE", purchaseLimitQty: 10 },
      { warehouseId: 801, sku: "NOPE-1", salePrice: 100, purchaseLimitQty: null },
    ],
  })

  await page.unroute(/\/api\/v1\/inventory\/store-items\/bulk/)
  await mockApi(page, "/v1/inventory/store-items/bulk", { method: "POST", body: ok({ created: 1, updated: 1 }) })
  await dialog.getByRole("button", { name: "Nhập", exact: true }).click()
  await expect(page.getByText("Đã tạo 1, cập nhật 1")).toBeVisible()
  await expect(dialog).toBeHidden()
})
