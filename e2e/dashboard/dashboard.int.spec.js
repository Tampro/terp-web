// @ts-check
/**
 * §5 company dashboards against the REAL backend with the company accounts of e2e/company.setup.js. Read-only.
 * The screen is compared with the API's own answer. Spec: GET /reports/dashboard?year=, /reports/calendar,
 * /org/announcements/my, /me (permissions decide HRM / Recruitment tabs or the Staff view).
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES } from "../../playwright.config.js"

/** @param {import('@playwright/test').Page} page @param {string} path */
async function api(page, path) {
  return page.evaluate(async (p) => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    const res = await fetch(`/api${p}`, { headers: { Authorization: `Bearer ${token}`, "Accept-Language": "vi" } })
    return { status: res.status, body: await res.json() }
  }, path)
}

/** @param {number | null | undefined} v */
const vi = (v) => (v == null ? "-" : new Intl.NumberFormat("vi-VN").format(v))

for (const role of /** @type {const} */ (["companyAdmin", "manager", "hr", "employee"])) {
  test.describe(role, () => {
    test.skip(!fs.existsSync(COMPANY_STATES[role]), `no ${role} session (account not set in .env)`)
    test.use({ storageState: COMPANY_STATES[role] })

    test(`INT-CDASH ${role}: dashboard đúng view theo quyền và khớp backend`, async ({ page }) => {
      await page.goto("/dashboard")
      const me = (await api(page, "/v1/me")).body.data
      const perms = me.permissions ?? []
      const hrm = ["EMPLOYEE_VIEW", "ATTENDANCE_VIEW", "LEAVE_VIEW"].some((p) => perms.includes(p))
      const rec = perms.includes("RECRUITMENT_VIEW")

      if (!hrm && !rec) {
        await expect(page.getByRole("heading", { name: /^Xin chào, / })).toBeVisible()
        const my = await api(page, "/v1/org/announcements/my?tab=ALL&size=5")
        if (my.status === 200) {
          for (const a of my.body.data.content ?? []) await expect(page.getByText(a.title, { exact: true }).first()).toBeVisible()
          if (!my.body.data.content?.length) await expect(page.getByText("Không có dữ liệu").first()).toBeVisible()
        } else {
          // e.g. 403 EMP_041 (no employee profile): the backend's own message, not a generic "not available"
          await expect(page.getByRole("note").filter({ hasText: my.body.message })).toBeVisible()
        }
      } else {
        const d = (await api(page, `/v1/reports/dashboard?year=${new Date().getFullYear()}`)).body.data
        if (hrm) {
          if (d.employees?.data) await expect(page.getByTestId("cdash.employees")).toHaveText(vi(d.employees.data.totalEmployees))
          if (d.attendance?.data) {
            await expect(page.getByTestId("cdash.present")).toHaveText(vi(d.attendance.data.presentToday))
            await expect(page.getByTestId("cdash.notMarked")).toHaveText(vi(d.attendance.data.notMarkedToday))
          }
        }
        if (rec && d.recruitment?.data) {
          if (hrm) await page.getByRole("tab", { name: "Tuyển dụng" }).click()
          await expect(page.getByTestId("cdash.activeJobs")).toHaveText(vi(d.recruitment.data.activeJobs))
          await expect(page.getByTestId("cdash.candidates")).toHaveText(vi(d.recruitment.data.totalCandidates))
        }
      }
      await expect(page.getByText(/undefined|NaN|Invalid Date/)).toHaveCount(0)
      await expect(page.getByText("Hiện chưa lấy được dữ liệu.")).toHaveCount(0) // no card whose service failed
    })
  })
}
