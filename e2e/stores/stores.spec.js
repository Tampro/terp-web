// @ts-check
/**
 * Stores, delivery zones, day-offs and the shop setting (/store/stores, /store/shop-setting).
 * Spec sources: store-service StoreController (StoreForm = full replacement on PUT, StoreDto), StoreZoneController
 * (ZoneForm {name, area GeoJSON Polygon}), StoreDayOffController (DayOffForm {date, reason}), ShopSettingController
 * ({slug, enabled}); STO_002 (code used), STO_009 (zone area invalid), STO_012 (day-off in the past), STO_014 (slug used).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["STORE_VIEW", "STORE_MANAGE", "INVENTORY_VIEW"]
const WAREHOUSES = [
  { id: "245", name: "E2E Gasan WH", active: true },
  { id: "246", name: "E2E Mapo WH", active: true },
]
const STORES = [
  { id: "7", code: "0293", name: "E2E Express Gasan", warehouseId: "245", timeZone: "Asia/Seoul", orderStart: "10:00:00", orderEnd: "22:00:00", deliveryFee: 3000, minOrderAmount: 20000, active: true },
  { id: "8", code: "0610", name: "E2E Express Mapo", warehouseId: "246", timeZone: "Asia/Seoul", orderStart: "09:00:00", orderEnd: "21:00:00", deliveryFee: 0, minOrderAmount: 0, active: false },
]

/** @param {import('@playwright/test').Page} page @param {{ permissions?: string[] }} [o] */
async function open(page, { permissions = ALL } = {}) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/inventory/warehouses", { method: "GET", body: pageOf(WAREHOUSES) })
  const list = await mockApi(page, "/v1/store/stores", { method: "GET", body: pageOf(STORES) })
  await page.goto("/store/stores")
  return list
}

/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("ST-001 menu 'Cửa hàng' và 'Shop trực tuyến' hiện khi có STORE_VIEW @smoke", async ({ page }) => {
  await open(page)
  await expect(page.getByRole("link", { name: "Cửa hàng", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Shop trực tuyến" })).toBeVisible()
  const gasan = page.getByRole("row").filter({ hasText: "E2E Express Gasan" })
  await expect(gasan).toContainText("E2E Gasan WH")
  await expect(gasan).toContainText("10:00–22:00")
  await expect(gasan).toContainText("Đang hoạt động")
  await expect(page.getByRole("row").filter({ hasText: "E2E Express Mapo" })).toContainText("Ngừng hoạt động")
})

test("ST-002 tìm kiếm đưa keyword lên URL và gọi lại danh sách", async ({ page }) => {
  const list = await open(page)
  await page.getByRole("textbox", { name: "Tìm kiếm" }).fill("gasan")
  await page.getByRole("button", { name: "Tìm kiếm" }).click()
  await expect(page).toHaveURL(/keyword=gasan/)
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("keyword")).toBe("gasan")
})

test("ST-003 thêm cửa hàng gửi đúng form; mã trùng → hiện lỗi STO_002 của backend, dialog vẫn mở", async ({ page }) => {
  await open(page)
  const create = await mockApi(page, "/v1/store/stores", { method: "POST", status: 400, body: fail("STO_002", "Mã cửa hàng này đã được dùng.") })
  await page.getByRole("button", { name: "Thêm cửa hàng" }).click()
  await page.getByLabel("Mã").fill("0293")
  await page.getByLabel("Tên").fill("E2E Express New")
  await page.getByRole("combobox", { name: "Kho" }).click()
  await page.getByRole("option", { name: "E2E Mapo WH" }).click()
  await page.getByLabel("Phí giao hàng").fill("3000")
  await page.getByRole("button", { name: "Lưu" }).click()
  await expect(page.getByText("Mã cửa hàng này đã được dùng.")).toBeVisible()
  await expect(page.getByRole("dialog")).toBeVisible()
  expect(create.requests.at(-1)?.body).toMatchObject({ code: "0293", name: "E2E Express New", warehouseId: 246, orderStart: "10:00", orderEnd: "22:00", deliveryFee: 3000, timeZone: "Asia/Seoul", active: true })
})

test("ST-004 giờ kết thúc trước giờ bắt đầu bị chặn ở form, không gọi API", async ({ page }) => {
  await open(page)
  const create = await mockApi(page, "/v1/store/stores", { method: "POST", body: ok({}) })
  await page.getByRole("button", { name: "Thêm cửa hàng" }).click()
  await page.getByLabel("Mã").fill("0700")
  await page.getByLabel("Tên").fill("E2E Late")
  await page.getByLabel("Nhận đơn từ").fill("22:00")
  await page.getByLabel("Nhận đơn đến").fill("10:00")
  await page.getByRole("button", { name: "Lưu" }).click()
  await expect(page.getByText("Phải sau giờ bắt đầu")).toBeVisible()
  expect(create.requests).toHaveLength(0)
})

test("ST-005 vùng giao hàng: danh sách, thêm GeoJSON, polygon sai → lỗi STO_009 của backend", async ({ page }) => {
  await open(page)
  await mockApi(page, "/v1/store/stores/7/zones", { method: "GET", body: ok([{ id: "3", storeId: "7", name: "Gasan 1", active: true, area: { type: "Polygon", coordinates: [[[126.88, 37.47], [126.9, 37.47], [126.9, 37.49], [126.88, 37.49], [126.88, 37.47]]] } }]) })
  const add = await mockApi(page, "/v1/store/stores/7/zones", { method: "POST", status: 400, body: fail("STO_009", "Vùng giao hàng không hợp lệ.") })
  await menu(page, "E2E Express Gasan").click()
  await page.getByRole("menuitem", { name: "Vùng giao hàng" }).click()
  await expect(page.getByText("Gasan 1")).toBeVisible()
  await expect(page.getByText("4 điểm")).toBeVisible()
  await page.getByLabel("Tên vùng").fill("Bow tie")
  await page.getByLabel(/Vùng \(GeoJSON/).fill('{"type":"Polygon","coordinates":[[[126.88,37.47],[126.9,37.49],[126.9,37.47],[126.88,37.49]]]}')
  await page.getByRole("button", { name: "Thêm vùng" }).click()
  await expect(page.getByText("Vùng giao hàng không hợp lệ.")).toBeVisible()
  expect(add.requests.at(-1)?.body).toMatchObject({ name: "Bow tie", area: { type: "Polygon" } })
})

test("ST-006 ngày nghỉ: thêm ngày gửi {date, reason}; ngày quá khứ → lỗi STO_012", async ({ page }) => {
  await open(page)
  await mockApi(page, "/v1/store/stores/7/day-offs", { method: "GET", body: ok([{ id: "5", storeId: "7", date: "2026-12-25", reason: "Christmas" }]) })
  const add = await mockApi(page, "/v1/store/stores/7/day-offs", { method: "POST", status: 400, body: fail("STO_012", "Không thể đặt ngày nghỉ trong quá khứ.") })
  await menu(page, "E2E Express Gasan").click()
  await page.getByRole("menuitem", { name: "Ngày nghỉ" }).click()
  await expect(page.getByText("2026-12-25")).toBeVisible()
  await page.getByLabel("Ngày", { exact: true }).fill("2020-01-01")
  await page.getByLabel("Lý do").fill("Old")
  await page.getByRole("button", { name: "Thêm ngày nghỉ" }).click()
  await expect(page.getByText("Không thể đặt ngày nghỉ trong quá khứ.")).toBeVisible()
  expect(add.requests.at(-1)?.body).toEqual({ date: "2020-01-01", reason: "Old" })
})

test("ST-007 không có STORE_MANAGE: không nút thêm, menu chỉ có xem vùng / ngày nghỉ", async ({ page }) => {
  await open(page, { permissions: ["STORE_VIEW"] })
  await expect(page.getByRole("button", { name: "Thêm cửa hàng" })).toHaveCount(0)
  await menu(page, "E2E Express Gasan").click()
  await expect(page.getByRole("menuitem", { name: "Sửa" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Xóa" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Vùng giao hàng" })).toBeVisible()
})

test("ST-008 shop setting: tải, lưu {slug, enabled}; slug trùng → lỗi STO_014; slug sai bị chặn ở form", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/store/shop-setting", { method: "GET", body: ok({ companyId: "10", slug: "e2e-shop", enabled: false }) })
  const save = await mockApi(page, "/v1/store/shop-setting", { method: "PUT", status: 400, body: fail("STO_014", "Địa chỉ shop này đã được sử dụng.") })
  await page.goto("/store/shop-setting")
  const slug = page.getByLabel("Địa chỉ shop")
  await expect(slug).toHaveValue("e2e-shop")
  await slug.fill("-bad")
  await page.getByRole("button", { name: "Lưu" }).click()
  await expect(page.getByText(/không bắt đầu hoặc kết thúc/)).toBeVisible()
  expect(save.requests).toHaveLength(0)
  await slug.fill("homeplus-express")
  await page.getByRole("switch", { name: "Mở cho khách" }).click()
  await page.getByRole("button", { name: "Lưu" }).click()
  await expect(page.getByText("Địa chỉ shop này đã được sử dụng.")).toBeVisible()
  expect(save.requests.at(-1)?.body).toEqual({ slug: "homeplus-express", enabled: true })
})
