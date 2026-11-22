// @ts-check
/**
 * §17 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /recruitment/{job-postings,candidates,interviews,offers}, /recruitment/career-settings, /public/career/{slug}.
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
  ["/recruitment/jobs", "/v1/recruitment/job-postings?page=0&size=20", "jobCode"],
  ["/recruitment/candidates", "/v1/recruitment/candidates?page=0&size=20", "email"],
  ["/recruitment/offers", "/v1/recruitment/offers?page=0&size=20", "salary"],
])) {
  test(`INT-RC ${route}: dòng đầu khớp backend`, async ({ page }) => {
    await page.goto(route)
    const res = await api(page, path)
    expect(res.status).toBe(200)
    const first = res.body.data.content?.[0]
    if (first && key !== "salary") await expect(page.getByRole("row").filter({ hasText: first[key] }).first()).toBeVisible()
    else if (first) await expect(page.getByRole("row").nth(1)).toBeVisible()
  })
}

test("INT-RC cổng tuyển dụng công khai: hiện số việc đang tuyển như backend", async ({ page }) => {
  await page.goto("/recruitment/setup?tab=portal")
  const settings = await api(page, "/v1/recruitment/career-settings")
  expect(settings.status).toBe(200)
  const s = settings.body.data
  test.skip(!s?.enabled, "career page not enabled")
  const site = await page.request.get(`/api/v1/public/career/${s.slug}`)
  expect(site.status()).toBe(200)
  const open = (await site.json()).data.openJobs
  await page.goto(`/careers/${s.slug}`)
  await expect(page.getByText(new RegExp(`^${open} vị trí đang tuyển$`))).toBeVisible()
})
