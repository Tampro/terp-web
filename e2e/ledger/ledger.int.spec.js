// @ts-check
/**
 * §13 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /accounting/journal-entries, /accounting/ledger/trial-balance, /accounting/balance-sheets.
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

test("INT-LE sổ nhật ký: dòng đầu khớp backend", async ({ page }) => {
  await page.goto("/accounting/journal-entries")
  const res = await api(page, "/v1/accounting/journal-entries?page=0&size=20")
  expect(res.status).toBe(200)
  const first = res.body.data.content?.[0]
  if (first) await expect(page.getByRole("row").filter({ hasText: first.number }).first()).toBeVisible()
})

test("INT-LE bảng cân đối thử: trạng thái cân bằng khớp backend", async ({ page }) => {
  const y = new Date().getFullYear()
  await page.goto(`/accounting/ledger?from=${y}-01-01&to=${y}-12-31`)
  const res = await api(page, `/v1/accounting/ledger/trial-balance?from=${y}-01-01&to=${y}-12-31`)
  expect(res.status).toBe(200)
  await expect(page.getByTestId("tb-balanced")).toHaveText(res.body.data.balanced ? "Cân bằng" : /Lệch/)
})

test("INT-LE bảng cân đối kế toán: danh sách tải được", async ({ page }) => {
  await page.goto("/accounting/balance-sheets")
  const res = await api(page, "/v1/accounting/balance-sheets?page=0&size=20")
  expect(res.status).toBe(200)
  const first = res.body.data.content?.[0]
  if (first) await expect(page.getByRole("cell", { name: String(first.financialYear) }).first()).toBeVisible()
  else await expect(page.getByText("Chưa có bảng cân đối nào.")).toBeVisible()
})
