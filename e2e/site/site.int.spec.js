// @ts-check
/**
 * §3.4 website CMS against the REAL backend, read-only: the landing editor shows the saved sections and the custom
 * pages list matches GET /v1/settings/admin/site/pages.
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { SUPERADMIN_STATE } from "../../playwright.config.js"

/** @param {import('@playwright/test').Page} page @param {string} path */
async function api(page, path) {
  return page.evaluate(async (p) => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    const r = await fetch(`/api${p}`, { headers: { Authorization: `Bearer ${token}` } })
    return r.json()
  }, path)
}

test.skip(!fs.existsSync(SUPERADMIN_STATE), "no superadmin session")
test.use({ storageState: SUPERADMIN_STATE })

test("INT-SITE-001 trang chủ hiện tên công ty đã lưu; danh sách trang khớp backend", async ({ page }) => {
  await page.goto("/website")
  const landing = await api(page, "/v1/settings/admin/site/landing")
  expect(landing.result).toBe(true)
  await expect(page.getByLabel("Tên công ty")).toHaveValue(landing.data.general?.companyName ?? "")
  await page.getByRole("tab", { name: "Trang tùy chỉnh" }).click()
  const pages = await api(page, "/v1/settings/admin/site/pages?page=0&size=20")
  const rows = pages.data.content ?? []
  if (!rows.length) await expect(page.getByText("Chưa có dữ liệu.")).toBeVisible()
  else await expect(page.getByRole("row").filter({ hasText: rows[0].title })).toContainText(rows[0].slug)
})
