// @ts-check
/**
 * Store items against the REAL backend with the Company Admin of e2e/company.setup.js.
 * Creates a ZZ warehouse, category, unit and two ZZ items (no opening stock), drives the screen, and removes everything
 * it made in `finally`. Spec: inventory-service /inventory/store-items (+ /bulk, /{id}/status).
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

test("INT-SI-001 thêm, sửa, tạm ngưng, xoá và nhập CSV trên backend thật", async ({ page }) => {
  await page.goto("/inventory/store-items")
  const x = Date.now().toString(36).toUpperCase()
  const made = { warehouse: "", category: "", unit: "", items: /** @type {string[]} */ ([]) }
  try {
    const wh = await api(page, "POST", "/v1/inventory/warehouses", { name: `ZZ Store ${x}`, address: "ZZ", city: "ZZ", zipCode: "00000", active: true })
    expect(wh.status).toBe(200)
    made.warehouse = wh.body.data.id
    made.category = (await api(page, "POST", "/v1/inventory/categories", { name: `ZZ Cat ${x}` })).body.data.id
    made.unit = (await api(page, "POST", "/v1/inventory/units", { name: `ZZ${x}` })).body.data.id
    for (const n of ["Egg", "Milk"]) {
      const it = await api(page, "POST", "/v1/inventory/items", {
        type: "PRODUCT", name: `ZZ ${n} ${x}`, sku: `ZZ-${n}-${x}`, categoryId: Number(made.category), unitId: Number(made.unit), salePrice: 5990, purchasePrice: 3000,
      })
      expect(it.status).toBe(200)
      made.items.push(it.body.data.id)
    }

    await page.goto(`/inventory/store-items?warehouseId=${made.warehouse}`)
    await expect(page.getByText("Cửa hàng này chưa bán món nào")).toBeVisible()

    // add
    await page.getByRole("button", { name: "Thêm món" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Gõ tên hoặc SKU").fill(`ZZ-Egg-${x}`)
    await dialog.getByRole("combobox", { name: "Món hàng" }).click()
    await page.getByRole("option", { name: new RegExp(`ZZ Egg ${x}`) }).click()
    await expect(dialog.getByLabel("Giá bán")).toHaveValue("5990")
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
    const egg = page.getByRole("row").filter({ hasText: `ZZ Egg ${x}` })
    await expect(egg).toContainText("Đang bán")

    // edit
    await page.getByRole("button", { name: `Thao tác cho ZZ Egg ${x}` }).click()
    await page.getByRole("menuitem", { name: "Sửa" }).click()
    await dialog.getByLabel("Giá bán").fill("5490")
    await dialog.getByLabel("Tối đa mỗi đơn").fill("3")
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
    await expect(egg).toContainText("5.490")
    await expect(egg).toContainText("3")

    // suspend
    await page.getByRole("button", { name: `Thao tác cho ZZ Egg ${x}` }).click()
    await page.getByRole("menuitem", { name: "Tạm ngưng" }).click()
    await expect(egg).toContainText("Tạm ngưng")

    // CSV: updates the egg row, creates the milk row
    await page.getByRole("button", { name: "Nhập CSV" }).click()
    await dialog.getByLabel("File CSV").setInputFiles({
      name: "zz.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`sku,salePrice,status\nZZ-Egg-${x},5800,ON_SALE\nZZ-Milk-${x},2500,\n`),
    })
    await dialog.getByRole("button", { name: "Nhập", exact: true }).click()
    await expect(page.getByText("Đã tạo 1, cập nhật 1")).toBeVisible()
    await expect(egg).toContainText("5.800")
    await expect(egg).toContainText("Đang bán")
    await expect(page.getByRole("row").filter({ hasText: `ZZ Milk ${x}` })).toContainText("2.500")

    // delete
    await page.getByRole("button", { name: `Thao tác cho ZZ Milk ${x}` }).click()
    await page.getByRole("menuitem", { name: "Xóa" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
    await expect(page.getByRole("row").filter({ hasText: `ZZ Milk ${x}` })).toHaveCount(0)
  } finally {
    if (made.warehouse) {
      const left = await api(page, "GET", `/v1/inventory/store-items?warehouseId=${made.warehouse}&size=100`)
      for (const r of left.body?.data?.content ?? []) await api(page, "DELETE", `/v1/inventory/store-items/${r.id}`)
    }
    for (const id of made.items) await api(page, "DELETE", `/v1/inventory/items/${id}`)
    if (made.unit) await api(page, "DELETE", `/v1/inventory/units/${made.unit}`)
    if (made.category) await api(page, "DELETE", `/v1/inventory/categories/${made.category}`)
    if (made.warehouse) await api(page, "DELETE", `/v1/inventory/warehouses/${made.warehouse}`)
  }
})
