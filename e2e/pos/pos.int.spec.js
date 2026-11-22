// @ts-check
/**
 * §10 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is sold.
 * Spec: GET /pos/orders, /pos/orders/{id}/pdf, /pos/reports/sales.
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
    const type = res.headers.get("content-type") ?? ""
    return { status: res.status, type, body: type.includes("json") ? await res.json() : null }
  }, path)
}

test("INT-POS-001 đơn POS: dòng đầu khớp backend, PDF biên nhận là application/pdf", async ({ page }) => {
  await page.goto("/pos/orders")
  const res = await api(page, "/v1/pos/orders?page=0&size=20")
  expect(res.status).toBe(200)
  const first = res.body.data.content?.[0]
  if (!first) return expect(page.getByText("Chưa có đơn POS")).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: first.number })).toContainText(first.receiptNumber)
  const pdf = await api(page, `/v1/pos/orders/${first.id}/pdf`)
  expect(pdf.status).toBe(200)
  expect(pdf.type).toContain("application/pdf")
})

test("INT-POS-002 báo cáo doanh số tháng này khớp backend", async ({ page }) => {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA")
  const to = now.toLocaleDateString("en-CA")
  await page.goto(`/pos/reports?from=${from}&to=${to}`)
  const res = await api(page, `/v1/pos/reports/sales?from=${from}&to=${to}`)
  expect(res.status).toBe(200)
  await expect(page.getByText(String(res.body.data.orders), { exact: true }).first()).toBeVisible()
})
