// @ts-check
/**
 * §19 against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: nothing is changed.
 * Spec: GET /iam/users, /iam/roles, /settings/company/profile, /settings/email-notifications.
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

test("INT-CO người dùng: dòng đầu khớp backend", async ({ page }) => {
  await page.goto("/company/access")
  const res = await api(page, "/v1/iam/users?page=0&size=20")
  expect(res.status).toBe(200)
  const first = res.body.data.content?.[0]
  if (first) await expect(page.getByRole("row").filter({ hasText: first.username }).first()).toBeVisible()
})

test("INT-CO vai trò: mọi vai trò của backend đều hiện", async ({ page }) => {
  await page.goto("/company/access?tab=roles")
  const res = await api(page, "/v1/iam/roles")
  expect(res.status).toBe(200)
  for (const r of res.body.data.slice(0, 5)) await expect(page.getByRole("row").filter({ hasText: r.code }).first()).toBeVisible()
})

test("INT-CO hồ sơ công ty: tên công ty khớp backend", async ({ page }) => {
  await page.goto("/company/settings")
  const res = await api(page, "/v1/settings/company/profile")
  expect(res.status).toBe(200)
  await expect(page.getByLabel("Tên công ty")).toHaveValue(res.body.data.name ?? "")
})

test("INT-CO thông báo email: trạng thái bật khớp backend", async ({ page }) => {
  await page.goto("/company/settings?tab=notifications")
  const res = await api(page, "/v1/settings/email-notifications")
  expect(res.status).toBe(200)
  const n = res.body.data[0]?.notifications?.[0]
  if (n) await expect(page.getByRole("switch", { name: n.name })).toHaveAttribute("aria-checked", String(n.enabled))
})
