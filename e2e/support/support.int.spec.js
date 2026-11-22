// @ts-check
/**
 * §18 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /support/tickets, /support/faqs, /support/portal/settings, /public/support/{slug}, /messenger/conversations.
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
  ["/support/tickets", "/v1/support/tickets?page=0&size=20", "ticketNumber"],
  ["/support/knowledge?tab=faqs", "/v1/support/faqs?page=0&size=20", "title"],
])) {
  test(`INT-SP ${route}: dòng đầu khớp backend`, async ({ page }) => {
    await page.goto(route)
    const res = await api(page, path)
    expect(res.status).toBe(200)
    const first = res.body.data.content?.[0]
    if (first) await expect(page.getByRole("row").filter({ hasText: first[key] }).first()).toBeVisible()
  })
}

test("INT-SP cổng hỗ trợ công khai: hiện tên thương hiệu như backend", async ({ page }) => {
  await page.goto("/support/setup")
  const settings = await api(page, "/v1/support/portal/settings")
  expect(settings.status).toBe(200)
  const s = settings.body.data
  test.skip(!s?.enabled, "support portal not enabled")
  await page.goto(`/help/${s.slug}`)
  await expect(page.getByRole("heading", { name: s.brandName })).toBeVisible()
})

test("INT-SP messenger: danh sách hội thoại tải được", async ({ page }) => {
  await page.goto("/messenger")
  const res = await api(page, "/v1/messenger/conversations")
  expect(res.status).toBe(200)
  await expect(page.getByRole("list", { name: "Cuộc trò chuyện" })).toBeVisible()
})
