// @ts-check
/**
 * §6 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * The screen is compared with the API's own answer. Spec: GET /sales/{proposals,quotations,invoices}(/status-counts),
 * /sales/returns, /accounting/customers, /inventory/items, /inventory/warehouses.
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES } from "../../playwright.config.js"
import salesVi from "../../src/locales/sales/vi.ts"

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

const PAGES = /** @type {const} */ ([
  ["proposals", "proposal", ["DRAFT", "SENT", "ACCEPTED", "REJECTED"]],
  ["quotations", "quotation", ["DRAFT", "SENT", "ACCEPTED", "REJECTED"]],
  ["invoices", "invoice", ["DRAFT", "POSTED", "PARTIAL", "PAID"]],
])

for (const [route, key, statuses] of PAGES) {
  test(`INT-SAL ${route}: số đếm tab và danh sách khớp backend`, async ({ page }) => {
    await page.goto(`/sales/${route}`)
    const counts = await api(page, `/v1/sales/${route}/status-counts`)
    expect(counts.status).toBe(200)
    const all = statuses.reduce((s, x) => s + (counts.body.data[x] ?? 0), 0)
    await expect(page.getByRole("tab", { name: `Tất cả (${all})` })).toBeVisible()
    const list = await api(page, `/v1/sales/${route}?page=0&size=20`)
    const rows = list.body.data.content ?? []
    for (const r of rows) {
      const row = page.getByRole("row").filter({ hasText: r.number })
      await expect(row).toBeVisible()
      // flags come from the backend (overdue = invoice past due; expired = still SENT past due)
      await expect(row.getByText(salesVi["sales.overdue"], { exact: true })).toHaveCount(r.overdue ? 1 : 0)
      await expect(row.getByText(salesVi["sales.expired"], { exact: true })).toHaveCount(r.expired ? 1 : 0)
    }
    if (!rows.length) await expect(page.getByText(salesVi[`sales.${key}.empty`])).toBeVisible()
    await expect(page.getByText(/undefined|NaN|Invalid Date/)).toHaveCount(0)

    if (rows.length) {
      // the detail of the first row shows its lines and the backend's total
      const detail = (await api(page, `/v1/sales/${route}/${rows[0].id}`)).body.data
      await page.goto(`/sales/${route}?view=${rows[0].id}`)
      const dialog = page.getByRole("dialog")
      await expect(dialog).toContainText(rows[0].number)
      for (const l of detail.lines ?? []) await expect(dialog.getByText(l.itemName, { exact: true })).toBeVisible()
      const total = new Intl.NumberFormat("vi-VN").format(detail.document.total)
      await expect(dialog.getByText(salesVi["sales.total"], { exact: true }).locator("..")).toContainText(total)
    }
  })
}

test("INT-SAL returns + danh mục form: danh sách trả hàng khớp, khách hàng/mặt hàng/kho trả 200", async ({ page }) => {
  await page.goto("/sales/returns")
  const list = await api(page, "/v1/sales/returns?page=0&size=20")
  expect(list.status).toBe(200)
  const rows = list.body.data.content ?? []
  for (const r of rows) await expect(page.getByText(r.number, { exact: true })).toBeVisible()
  if (!rows.length) await expect(page.getByText(salesVi["sales.return.empty"])).toBeVisible()
  for (const p of ["/v1/accounting/customers?size=50", "/v1/inventory/items?size=50", "/v1/inventory/warehouses?active=true&size=100"]) {
    expect((await api(page, p)).status, p).toBe(200)
  }
  // the create form opens with the real lookups (closing it sends nothing)
  await page.getByRole("button", { name: "Tạo phiếu trả hàng" }).click()
  await expect(page.getByRole("combobox", { name: "Hóa đơn gốc" })).toBeVisible()
  await page.keyboard.press("Escape")
})
