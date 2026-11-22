// @ts-check
/**
 * §9 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /inventory/items, /inventory/categories, /inventory/taxes, /inventory/units.
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES } from "../../playwright.config.js"

test.skip(!fs.existsSync(COMPANY_STATES.companyAdmin), "no companyAdmin session")
test.use({ storageState: COMPANY_STATES.companyAdmin })

/** @param {import('@playwright/test').Page} page @param {string} path */
async function api(page, path) {
  return page.evaluate(async (p) => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    const res = await fetch(`/api${p}`, { headers: { Authorization: `Bearer ${token}`, "Accept-Language": "vi" } })
    return { status: res.status, body: await res.json() }
  }, path)
}

test("INT-PRD-001 mặt hàng: dòng đầu khớp backend (SKU, đơn vị)", async ({ page }) => {
  await page.goto("/inventory/items")
  const res = await api(page, "/v1/inventory/items?page=0&size=20")
  expect(res.status).toBe(200)
  const first = res.body.data.content?.[0]
  if (!first) return expect(page.getByText("Chưa có mặt hàng")).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: first.sku })
  await expect(row).toContainText(first.name)
  if (first.unitName) await expect(row).toContainText(first.unitName)
})

test("INT-PRD-002 thiết lập: số dòng mỗi tab khớp backend", async ({ page }) => {
  for (const [tab, path] of /** @type {const} */ ([
    ["", "/v1/inventory/categories"],
    ["?tab=taxes", "/v1/inventory/taxes"],
    ["?tab=units", "/v1/inventory/units"],
  ])) {
    await page.goto(`/inventory/setup${tab}`)
    const res = await api(page, path)
    expect(res.status).toBe(200)
    const rows = res.body.data
    if (rows.length === 0) await expect(page.getByText("Chưa có dữ liệu")).toBeVisible()
    else await expect(page.locator("tbody tr")).toHaveCount(rows.length)
  }
})
