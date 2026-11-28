// @ts-check
/**
 * Stores against the REAL backend with the Company Admin of e2e/company.setup.js (needs STORE_MANAGE, granted to
 * COMPANY_ADMIN by store-service-core). Creates a ZZ warehouse, drives the store, zone and day-off screens, saves a ZZ
 * shop slug, and restores / removes everything in `finally`. Spec: store-service /store/stores, /zones, /day-offs,
 * /store/shop-setting.
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES } from "../../playwright.config.js"

test.skip(!fs.existsSync(COMPANY_STATES.companyAdmin), "no companyAdmin session")
test.use({ storageState: COMPANY_STATES.companyAdmin })

/** @param {import('@playwright/test').Page} page @param {string} method @param {string} path @param {unknown} [body] */
async function api(page, method, path, body) {
  return page.evaluate(
    async ({ m, p, b }) => {
      const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
      const res = await fetch(`/api${p}`, {
        method: m,
        headers: { Authorization: `Bearer ${token}`, "Accept-Language": "vi", "Content-Type": "application/json" },
        body: b === undefined ? undefined : JSON.stringify(b),
      })
      return { status: res.status, body: await res.json().catch(() => ({})) }
    },
    { m: method, p: path, b: body }
  )
}

/** Tomorrow as yyyy-MM-dd in Asia/Seoul (the store's zone), so it is never "in the past". */
const tomorrowKst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(Date.now() + 86400000))

test("INT-ST-001 thêm cửa hàng, vùng giao hàng, ngày nghỉ và shop trên backend thật", async ({ page }) => {
  await page.goto("/store/stores")
  const x = Date.now().toString(36).toUpperCase()
  const made = { warehouse: "", store: "" }
  const before = (await api(page, "GET", "/v1/store/shop-setting")).body.data
  try {
    const wh = await api(page, "POST", "/v1/inventory/warehouses", { name: `ZZ Store WH ${x}`, address: "ZZ", city: "ZZ", zipCode: "00000", active: true })
    expect(wh.status).toBe(200)
    made.warehouse = wh.body.data.id
    await page.reload()

    // store via the dialog
    await page.getByRole("button", { name: "Thêm cửa hàng" }).click()
    await page.getByLabel("Mã").fill(`ZZ${x}`.slice(0, 20))
    await page.getByLabel("Tên").fill(`ZZ Express ${x}`)
    await page.getByRole("combobox", { name: "Kho" }).click()
    await page.getByRole("option", { name: `ZZ Store WH ${x}` }).click()
    await page.getByLabel("Phí giao hàng").fill("3000")
    await page.getByRole("button", { name: "Lưu" }).click()
    const row = page.getByRole("row").filter({ hasText: `ZZ Express ${x}` })
    await expect(row).toContainText("10:00–22:00")
    const list = await api(page, "GET", `/v1/store/stores?keyword=${encodeURIComponent(`ZZ Express ${x}`)}`)
    made.store = list.body.data.content[0].id

    // zone: an invalid polygon shows the backend's STO_009 text, a square is added
    await page.getByRole("button", { name: `Thao tác cho ZZ Express ${x}` }).click()
    await page.getByRole("menuitem", { name: "Vùng giao hàng" }).click()
    await page.getByLabel("Tên vùng").fill("ZZ bow tie")
    await page.getByLabel(/Vùng \(GeoJSON/).fill('{"type":"Polygon","coordinates":[[[126.88,37.47],[126.9,37.49],[126.9,37.47],[126.88,37.49]]]}')
    await page.getByRole("button", { name: "Thêm vùng" }).click()
    await expect(page.getByText(/Vùng giao hàng không hợp lệ/)).toBeVisible()
    await page.getByLabel("Tên vùng").fill("ZZ square")
    await page.getByLabel(/Vùng \(GeoJSON/).fill('{"type":"Polygon","coordinates":[[[126.88,37.47],[126.9,37.47],[126.9,37.49],[126.88,37.49]]]}')
    await page.getByRole("button", { name: "Thêm vùng" }).click()
    await expect(page.getByText("ZZ square")).toBeVisible()
    await expect(page.getByText("4 điểm")).toBeVisible()
    await page.keyboard.press("Escape")

    // day-off tomorrow (KST)
    const day = tomorrowKst()
    await page.getByRole("button", { name: `Thao tác cho ZZ Express ${x}` }).click()
    await page.getByRole("menuitem", { name: "Ngày nghỉ" }).click()
    await page.getByLabel("Ngày", { exact: true }).fill(day)
    await page.getByLabel("Lý do").fill("ZZ count")
    await page.getByRole("button", { name: "Thêm ngày nghỉ" }).click()
    await expect(page.getByText(day)).toBeVisible()
    await page.getByLabel("Ngày", { exact: true }).fill(day)
    await page.getByRole("button", { name: "Thêm ngày nghỉ" }).click()
    await expect(page.getByText(/đã là ngày nghỉ/)).toBeVisible()
    await page.keyboard.press("Escape")

    // shop setting
    await page.goto("/store/shop-setting")
    await page.getByLabel("Địa chỉ shop").fill(`zz-${x.toLowerCase()}`)
    await page.getByRole("button", { name: "Lưu" }).click()
    await expect(page.getByText("Đã lưu")).toBeVisible()
    expect((await api(page, "GET", "/v1/store/shop-setting")).body.data.slug).toBe(`zz-${x.toLowerCase()}`)
  } finally {
    if (made.store) await api(page, "DELETE", `/v1/store/stores/${made.store}`)
    if (made.warehouse) await api(page, "DELETE", `/v1/inventory/warehouses/${made.warehouse}`)
    if (before?.slug) await api(page, "PUT", "/v1/store/shop-setting", { slug: before.slug, enabled: !!before.enabled })
  }
})
