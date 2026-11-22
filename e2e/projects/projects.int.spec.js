// @ts-check
/**
 * §11 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is created.
 * Spec: GET /projects, /projects/{id}/tasks/board, /forms, /reports/calendar, /meeting/zoom/status,
 * /attendance/timesheets/month.
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

test("INT-PRJ-001 dự án và Kanban task khớp backend", async ({ page }) => {
  await page.goto("/projects")
  const res = await api(page, "/v1/projects?page=0&size=12")
  expect(res.status).toBe(200)
  const first = res.body.data.content?.[0]
  if (!first) return expect(page.getByText("Chưa có dự án")).toBeVisible()
  await expect(page.getByRole("link", { name: first.name })).toBeVisible()
  await page.goto(`/projects/${first.id}?tab=tasks`)
  const board = await api(page, `/v1/projects/${first.id}/tasks/board`)
  for (const col of board.body.data) {
    await expect(page.getByRole("region", { name: new RegExp(`^${col.stage.name}`) }).locator("[data-card-id]")).toHaveCount(col.tasks.length)
  }
})

test("INT-PRJ-002 biểu mẫu, lịch, Zoom, bảng chấm giờ trả 200 và hiển thị", async ({ page }) => {
  await page.goto("/forms")
  const forms = await api(page, "/v1/forms?page=0&size=20")
  expect(forms.status).toBe(200)
  const f = forms.body.data.content?.[0]
  if (f) await expect(page.getByRole("row").filter({ hasText: f.name })).toBeVisible()

  await page.goto("/calendar")
  await expect(page.getByTestId("calendar-title")).toBeVisible()
  const now = new Date()
  const day = now.toLocaleDateString("en-CA")
  expect((await api(page, `/v1/reports/calendar?from=${day}&to=${day}`)).status).toBe(200)

  await page.goto("/meetings")
  const zoom = await api(page, "/v1/meeting/zoom/status")
  expect(zoom.status).toBe(200)
  if (!zoom.body.data.enabled) await expect(page.getByRole("button", { name: "Lên lịch họp" })).toBeDisabled()

  await page.goto("/timesheets")
  const ts = await api(page, `/v1/attendance/timesheets/month?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
  expect(ts.status).toBe(200)
})
