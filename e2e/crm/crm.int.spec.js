// @ts-check
/**
 * §7 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * The screen is compared with the API's own answer. Spec: GET /crm/pipelines, /crm/leads, /crm/deals/board,
 * /crm/contracts(/status-counts).
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

test("INT-CRM-001 leads: dòng đầu tiên của pipeline đầu tiên khớp backend", async ({ page }) => {
  await page.goto("/crm/leads")
  const pipelines = await api(page, "/v1/crm/pipelines")
  expect(pipelines.status).toBe(200)
  const first = pipelines.body.data[0]
  test.skip(!first, "the company has no pipeline")
  const list = await api(page, `/v1/crm/leads?pipelineId=${first.id}&page=0&size=20`)
  const rows = list.body.data.content ?? []
  if (rows.length === 0) return expect(page.getByText("Chưa có lead")).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: rows[0].name })
  await expect(row).toContainText(rows[0].subject)
  await expect(row).toContainText(`${rows[0].tasksDone}/${rows[0].tasksTotal}`)
  await expect(row).toContainText(rows[0].stageName)
})

test("INT-CRM-002 deal board: số thẻ mỗi cột khớp backend", async ({ page }) => {
  await page.goto("/crm/deals?mode=board")
  const pipelines = await api(page, "/v1/crm/pipelines")
  const first = pipelines.body.data[0]
  test.skip(!first, "the company has no pipeline")
  const board = await api(page, `/v1/crm/deals/board?pipelineId=${first.id}`)
  expect(board.status).toBe(200)
  for (const col of board.body.data) {
    await expect(page.getByRole("region", { name: col.name }).locator("[data-card-id]")).toHaveCount(col.deals.length)
  }
})

test("INT-CRM-003 hợp đồng: thẻ số lượng và dòng đầu khớp backend", async ({ page }) => {
  await page.goto("/crm/contracts")
  const counts = await api(page, "/v1/crm/contracts/status-counts")
  expect(counts.status).toBe(200)
  await expect(page.getByRole("button", { name: `Tổng ${counts.body.data.total}` })).toBeVisible()
  await expect(page.getByRole("button", { name: `Hiệu lực ${counts.body.data.active}` })).toBeVisible()
  const list = await api(page, "/v1/crm/contracts?page=0&size=20")
  const rows = list.body.data.content ?? []
  if (rows.length === 0) return expect(page.getByText("Chưa có hợp đồng")).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: rows[0].number })
  await expect(row).toContainText(rows[0].subject)
})
