// @ts-check
/**
 * §3.5 email templates against the REAL backend, read-only: the list matches GET /v1/settings/admin/email-templates
 * and the editor shows the saved English subject.
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

test("INT-ET-001 danh sách và trang sửa khớp backend", async ({ page }) => {
  await page.goto("/email-templates")
  const list = await api(page, "/v1/settings/admin/email-templates?page=0&size=20")
  expect(list.result).toBe(true)
  const first = list.data.content[0]
  await page.getByRole("button", { name: first.name, exact: true }).click()
  const detail = await api(page, `/v1/settings/admin/email-templates/${first.id}`)
  await page.getByRole("tab", { name: "Tiếng Anh" }).click()
  const en = detail.data.contents.find((/** @type {{lang:string}} */ c) => c.lang === "en")
  await expect(page.getByLabel("Tiêu đề email *")).toHaveValue(en?.subject ?? "")
})
