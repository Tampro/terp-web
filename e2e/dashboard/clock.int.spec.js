// @ts-check
/**
 * §5 Clock In against the REAL backend with the Company Admin of e2e/company.setup.js. Read-only: never clocks in.
 * Spec: GET /attendance/me/today (ATTENDANCE_SELF). The test company admin has no employee profile, so the card must
 * explain that instead of offering the buttons; with a profile it shows the shift and the allowed button.
 */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { COMPANY_STATES } from "../../playwright.config.js"

test.skip(!fs.existsSync(COMPANY_STATES.companyAdmin), "no companyAdmin session")
test.use({ storageState: COMPANY_STATES.companyAdmin })

test("INT-CLK thẻ chấm công khớp /attendance/me/today của backend", async ({ page }) => {
  await page.goto("/dashboard")
  const res = await page.evaluate(async () => {
    const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
    const r = await fetch("/api/v1/attendance/me/today", { headers: { Authorization: `Bearer ${token}`, "Accept-Language": "vi" } })
    return { status: r.status, body: await r.json() }
  })
  const card = page.getByTestId("clock-card")
  if (res.status === 200) {
    const d = res.body.data
    if (d.canClockIn) await expect(card.getByRole("button", { name: "Vào ca" })).toBeVisible()
    if (d.canClockOut) await expect(card.getByRole("button", { name: "Ra ca" })).toBeVisible()
    if (d.shift) await expect(card.getByTestId("clock-shift")).toContainText(d.shift.name)
  } else {
    expect(["ATT_060", "EMP_001"]).toContain(res.body.code)
    await expect(card).toContainText("chưa gắn với hồ sơ nhân viên")
  }
})
