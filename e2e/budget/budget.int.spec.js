// @ts-check
/**
 * §14 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /accounting/goals, /accounting/budgets, /accounting/budget-periods.
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

for (const [route, path] of /** @type {const} */ ([
  ["/accounting/goals", "/v1/accounting/goals?page=0&size=20"],
  ["/accounting/budgets", "/v1/accounting/budgets?page=0&size=20"],
  ["/accounting/budgets?tab=periods", "/v1/accounting/budget-periods?page=0&size=200"],
])) {
  test(`INT-BG ${route}: dòng đầu khớp backend`, async ({ page }) => {
    await page.goto(route)
    const res = await api(page, path)
    expect(res.status).toBe(200)
    const first = res.body.data.content?.[0]
    if (first) await expect(page.getByRole("row").filter({ hasText: first.name }).first()).toBeVisible()
  })
}
