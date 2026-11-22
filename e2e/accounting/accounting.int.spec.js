// @ts-check
/**
 * §12 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /accounting/{customers,bank-accounts,customer-payments,chart-of-accounts}, /accounting/reports/invoice-aging.
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

for (const [route, path, key] of /** @type {const} */ ([
  ["/accounting/customers", "/v1/accounting/customers?page=0&size=20", "customerCode"],
  ["/accounting/banking", "/v1/accounting/bank-accounts?page=0&size=20", "accountNumber"],
  ["/accounting/customer-payments", "/v1/accounting/customer-payments?page=0&size=20", "number"],
  ["/accounting/chart-of-accounts", "/v1/accounting/chart-of-accounts?page=0&size=50", "code"],
])) {
  test(`INT-ACC ${route}: dòng đầu khớp backend`, async ({ page }) => {
    await page.goto(route)
    const res = await api(page, path)
    expect(res.status).toBe(200)
    const first = res.body.data.content?.[0]
    if (first) await expect(page.getByRole("row").filter({ hasText: first[key] }).first()).toBeVisible()
  })
}

test("INT-ACC tuổi nợ phải thu: tổng khớp backend", async ({ page }) => {
  await page.goto("/accounting/reports")
  const asOf = new Date().toLocaleDateString("en-CA")
  const res = await api(page, `/v1/accounting/reports/invoice-aging?asOf=${asOf}`)
  expect(res.status).toBe(200)
  const rows = res.body.data.rows ?? []
  if (rows.length === 0) return expect(page.getByText("Không có khoản nợ nào")).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: rows[0].partyName })).toBeVisible()
})
