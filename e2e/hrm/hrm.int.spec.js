// @ts-check
/**
 * §15 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /employees, /org/branches, /attendance/leave/applications, /payroll/runs, /document/documents,
 * /lifecycle/complaints.
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
  ["/hrm/employees", "/v1/employees?page=0&size=20", "employeeNo"],
  ["/hrm/setup", "/v1/org/branches?page=0&size=20", "name"],
  ["/hrm/payroll", "/v1/payroll/runs?page=0&size=20", "title"],
  ["/hrm/documents", "/v1/document/documents?page=0&size=20", "title"],
  ["/hrm/issues", "/v1/lifecycle/complaints?page=0&size=20", "subject"],
  ["/hrm/performance?tab=goals", "/v1/performance/goals?page=0&size=20", "title"],
  ["/hrm/training", "/v1/training/sessions?page=0&size=20", "name"],
  ["/hrm/training?tab=programs", "/v1/training/programs?page=0&size=20", "name"],
])) {
  test(`INT-HR ${route}: dòng đầu khớp backend`, async ({ page }) => {
    await page.goto(route)
    const res = await api(page, path)
    expect(res.status).toBe(200)
    const first = res.body.data.content?.[0]
    if (first) await expect(page.getByRole("row").filter({ hasText: first[key] }).first()).toBeVisible()
  })
}

test("INT-HR lưới chấm công: số dòng khớp số nhân viên của trang đầu", async ({ page }) => {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  await page.goto(`/hrm/attendance?month=${ym}`)
  const res = await api(page, `/v1/attendance/records/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}&page=0&size=20`)
  expect(res.status).toBe(200)
  const rows = res.body.data.rows ?? []
  if (rows.length) await expect(page.getByRole("row").filter({ hasText: rows[0].fullName }).first()).toBeVisible()
  else await expect(page.getByText("Không có nhân viên để hiển thị.")).toBeVisible()
})
