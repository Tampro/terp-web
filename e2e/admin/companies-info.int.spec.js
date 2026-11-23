// @ts-check
/** §3.2 company info panel against the REAL backend, read-only: matches GET /v1/iam/companies/{id}/info. */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { SUPERADMIN_STATE } from "../../playwright.config.js"

test.skip(!fs.existsSync(SUPERADMIN_STATE), "no superadmin session")
test.use({ storageState: SUPERADMIN_STATE })

test("INT-CMP-INFO-001 thông tin công ty khớp backend", async ({ page }) => {
  await page.goto("/companies")
  const get = (/** @type {string} */ p) =>
    page.evaluate(async (path) => {
      const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
      return (await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })).json()
    }, p)
  const first = (await get("/v1/iam/companies?page=0&size=20")).data.content[0]
  const info = (await get(`/v1/iam/companies/${first.id}/info`)).data
  await page.getByRole("button", { name: `Thao tác cho ${first.name}`, exact: true }).click()
  await page.getByRole("menuitem", { name: "Thông tin công ty" }).click()
  await expect(page.getByTestId("company-accounts")).toContainText(String(info.userCount))
  for (const a of info.administrators ?? []) await expect(page.getByTestId("company-info")).toContainText(a.username)
})
