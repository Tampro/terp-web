// @ts-check
/**
 * §8 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /purchase/invoices(/status-counts), /purchase/returns, /inventory/warehouses, /inventory/transfers.
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

test("INT-PUR-001 hóa đơn mua: số đếm tab và dòng đầu khớp backend", async ({ page }) => {
  await page.goto("/purchase/invoices")
  const counts = await api(page, "/v1/purchase/invoices/status-counts")
  expect(counts.status).toBe(200)
  const all = ["DRAFT", "POSTED", "PARTIAL", "PAID"].reduce((s, x) => s + (counts.body.data[x] ?? 0), 0)
  await expect(page.getByRole("tab", { name: `Tất cả (${all})` })).toBeVisible()
  const rows = (await api(page, "/v1/purchase/invoices?page=0&size=20")).body.data.content ?? []
  if (rows.length === 0) return expect(page.getByText("Chưa có hóa đơn mua")).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: rows[0].number })).toContainText(rows[0].vendorName)
})

test("INT-PUR-002 phiếu trả, kho, chuyển kho: dòng đầu khớp backend", async ({ page }) => {
  for (const [route, path, key] of /** @type {const} */ ([
    ["/purchase/returns", "/v1/purchase/returns?page=0&size=20", "number"],
    ["/inventory/warehouses", "/v1/inventory/warehouses?page=0&size=20", "name"],
  ])) {
    await page.goto(route)
    const res = await api(page, path)
    expect(res.status).toBe(200)
    const first = res.body.data.content?.[0]
    if (first) await expect(page.getByRole("row").filter({ hasText: first[key] })).toBeVisible()
  }
  await page.goto("/inventory/transfers")
  const tr = await api(page, "/v1/inventory/transfers?page=0&size=20")
  expect(tr.status).toBe(200)
  await expect(page.locator("tbody tr")).toHaveCount(Math.max(1, tr.body.data.content.length))
})
