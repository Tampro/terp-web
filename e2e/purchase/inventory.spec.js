// @ts-check
/**
 * Warehouses and stock transfers (manual §8.3, §8.4).
 * Spec sources: inventory-service WarehouseController (WarehouseForm {name, address, city, zipCode, phone, email,
 * active}; list city / active), StockTransferController (TransferForm; delete only), StockController (GET /stock);
 * INV_008 (warehouse holds stock), INV_017 (not enough stock), INV_022 (same warehouse).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { ITEMS, PURCHASE_ALL, STOCK_801, TRANSFERS, WAREHOUSES } from "./data.js"

test("INV-001 kho: danh sách, lọc trạng thái và thành phố gửi active/city @smoke", async ({ page }) => {
  await mockLoggedIn(page, { permissions: PURCHASE_ALL })
  const list = await mockApi(page, "/v1/inventory/warehouses", { method: "GET", body: pageOf(WAREHOUSES) })
  await page.goto("/inventory/warehouses")
  await expect(page.getByRole("row").filter({ hasText: "E2E Kho HCM" })).toContainText("700000")
  await page.getByRole("combobox", { name: "Trạng thái" }).click()
  await page.getByRole("option", { name: "Ngừng hoạt động" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("active")).toBe("false")
  await page.getByLabel("Thành phố").fill("Hà Nội")
  await page.getByRole("button", { name: "Tìm kiếm" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("city")).toBe("Hà Nội")
})

test("INV-002 tạo kho: bắt buộc tên/địa chỉ/thành phố/mã bưu chính, gửi WarehouseForm; xóa kho còn hàng hiện INV_008", async ({ page }) => {
  await mockLoggedIn(page, { permissions: PURCHASE_ALL })
  await mockApi(page, "/v1/inventory/warehouses", { method: "GET", body: pageOf(WAREHOUSES) })
  const create = await mockApi(page, "/v1/inventory/warehouses", { method: "POST", body: ok(WAREHOUSES[0]) })
  await mockApi(page, "/v1/inventory/warehouses/801", {
    method: "DELETE",
    status: 400,
    body: fail("INV_008", "Kho vẫn còn hàng tồn nên không thể xóa."),
  })
  await page.goto("/inventory/warehouses")
  await page.getByRole("button", { name: "Tạo kho" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Bắt buộc")).toHaveCount(4)
  await dialog.getByLabel("Tên").fill("E2E Kho Đà Nẵng")
  await dialog.getByLabel("Địa chỉ").fill("3 E2E Street")
  await dialog.getByLabel("Thành phố").fill("Đà Nẵng")
  await dialog.getByLabel("Mã bưu chính").fill("550000")
  await dialog.getByLabel("Email").fill("kho@example")
  await expect(dialog.getByText("Nhập email hợp lệ")).toBeVisible()
  await dialog.getByLabel("Email").fill("")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ name: "E2E Kho Đà Nẵng", address: "3 E2E Street", city: "Đà Nẵng", zipCode: "550000", phone: null, email: null, active: true })

  await page.getByRole("button", { name: "Thao tác cho E2E Kho Hà Nội" }).click()
  await page.getByRole("menuitem", { name: "Xóa" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
  await expect(page.getByText("Kho vẫn còn hàng tồn nên không thể xóa.")).toBeVisible()
})

test("INV-010 chuyển kho: từng ô mở sau ô trước, kho đích bỏ kho nguồn, chỉ sản phẩm còn tồn, chặn quá tồn kho", async ({ page }) => {
  await mockLoggedIn(page, { permissions: PURCHASE_ALL })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/transfers", { method: "GET", body: pageOf(TRANSFERS) })
  const stock = await mockApi(page, "/v1/inventory/stock", { body: ok(STOCK_801) })
  const create = await mockApi(page, "/v1/inventory/transfers", { method: "POST", body: ok(TRANSFERS[0]) })
  await page.goto("/inventory/transfers")
  await expect(page.getByRole("row").filter({ hasText: "E2E Keyboard" })).toContainText("E2E Kho HCM")

  await page.getByRole("button", { name: "Tạo phiếu chuyển kho" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("combobox", { name: "Đến kho" })).toBeDisabled()
  await expect(dialog.getByRole("combobox", { name: "Mặt hàng" })).toBeDisabled()
  await expect(dialog.getByLabel("SL")).toBeDisabled()
  await dialog.getByRole("combobox", { name: "Từ kho" }).click()
  await page.getByRole("option", { name: "E2E Kho Hà Nội" }).click()
  await expect.poll(() => stock.requests.at(-1)?.url.searchParams.get("warehouseId")).toBe("801")
  await dialog.getByRole("combobox", { name: "Đến kho" }).click()
  await expect(page.getByRole("option", { name: "E2E Kho Hà Nội" })).toHaveCount(0)
  await page.getByRole("option", { name: "E2E Kho HCM" }).click()
  await dialog.getByRole("combobox", { name: "Mặt hàng" }).click()
  await expect(page.getByRole("option", { name: /E2E Mouse/ })).toHaveCount(0) // no stock there
  await page.getByRole("option", { name: /E2E Keyboard/ }).click()
  await expect(dialog.getByText("Tồn kho: 64")).toBeVisible()
  await dialog.getByLabel("SL").fill("65")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Chỉ còn 64 trong kho")).toBeVisible()
  expect(create).toHaveLength(0)
  await dialog.getByLabel("SL").fill("5")
  await dialog.getByLabel("Ngày chuyển").fill("2026-11-22")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ fromWarehouseId: 801, toWarehouseId: 802, itemId: 601, quantity: 5, transferDate: "2026-11-22" })
})

test("INV-011 chỉ INVENTORY_VIEW: không tạo kho, không tạo hay xóa phiếu chuyển", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["INVENTORY_VIEW"] })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/transfers", { method: "GET", body: pageOf(TRANSFERS) })
  await page.goto("/inventory/transfers")
  await expect(page.getByRole("row").filter({ hasText: "E2E Keyboard" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Tạo phiếu chuyển kho" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Xóa phiếu chuyển/ })).toHaveCount(0)
  await page.goto("/inventory/warehouses")
  await expect(page.getByRole("row").filter({ hasText: "E2E Kho HCM" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Tạo kho" })).toHaveCount(0)
})
