// @ts-check
/**
 * §5 Staff: Clock In / Clock Out on the dashboard. Spec: attendance-service ClockController (ATTENDANCE_SELF):
 * GET /attendance/me/today {date, record, shift, canClockIn, canClockOut}; POST /clock-in, /clock-out ClockForm {notes};
 * ATT_055 already clocked in; ATT_060 / EMP_001 no employee profile. The clock shows the company time zone
 * (GET /settings/company/effective system.defaultTimezone).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const SHIFT = { id: "7", name: "E2E Day shift", startTime: "08:00:00", endTime: "17:00:00", gracePeriodMinutes: 10, nightShift: false }

/** @param {import('@playwright/test').Page} page */
async function staff(page) {
  await mockLoggedIn(page, { permissions: ["ATTENDANCE_SELF"] })
  await mockApi(page, "/v1/org/announcements/my", { body: pageOf([]) })
  await mockApi(page, "/v1/reports/calendar", { body: ok([]) })
  await mockApi(page, "/v1/settings/company/effective", { body: ok({ system: { defaultTimezone: "Asia/Ho_Chi_Minh" } }) })
}

test("CLK-001 nhân viên: vào ca gửi ghi chú, thẻ chuyển sang Ra ca; ra ca xong báo đã chấm đủ @smoke", async ({ page }) => {
  await staff(page)
  let phase = 0
  const records = [
    null,
    { clockIn: "08:05:00", clockOut: null, status: "PRESENT", late: false, totalHours: 0 },
    { clockIn: "08:05:00", clockOut: "17:30:00", status: "PRESENT", late: false, totalHours: 8.42, overtimeHours: 0.42 },
  ]
  await page.route("**/api/v1/attendance/me/today", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(ok({ date: "2026-11-23", shift: SHIFT, record: records[phase], canClockIn: phase === 0, canClockOut: phase === 1 })) }),
  )
  const clockIn = await mockApi(page, "/v1/attendance/me/clock-in", { method: "POST", body: ok(records[1]) })
  const clockOut = await mockApi(page, "/v1/attendance/me/clock-out", { method: "POST", body: ok(records[2]) })
  await page.goto("/dashboard")
  const card = page.getByTestId("clock-card")
  await expect(card.getByTestId("clock-shift")).toHaveText("E2E Day shift · 08:00–17:00")
  await expect(card).toContainText("Asia/Ho_Chi_Minh")
  await expect(card).toContainText("Được trễ 10 phút")
  await expect(card.getByRole("button", { name: "Ra ca" })).toHaveCount(0)
  await card.getByLabel("Ghi chú (tùy chọn)").fill("E2E at the client office")
  phase = 1
  await card.getByRole("button", { name: "Vào ca" }).click()
  await expect.poll(() => clockIn.length).toBe(1)
  expect(clockIn[0]).toEqual({ notes: "E2E at the client office" })
  await expect(card.getByTestId("clock-in-time")).toHaveText("08:05")
  phase = 2
  await card.getByRole("button", { name: "Ra ca" }).click()
  await expect.poll(() => clockOut.length).toBe(1)
  expect(clockOut[0]).toEqual({})
  await expect(card.getByTestId("clock-out-time")).toHaveText("17:30")
  await expect(card).toContainText("Tăng ca 0.42 giờ")
  await expect(card).toContainText("Hôm nay bạn đã chấm công vào và ra.")
})

test("CLK-002 tài khoản chưa gắn hồ sơ nhân viên: thẻ giải thích, không có nút chấm công", async ({ page }) => {
  await staff(page)
  await mockApi(page, "/v1/attendance/me/today", { status: 404, body: fail("EMP_001", "Employee not found") })
  await page.goto("/dashboard")
  const card = page.getByTestId("clock-card")
  await expect(card).toContainText("chưa gắn với hồ sơ nhân viên")
  await expect(card.getByRole("button")).toHaveCount(0)
})

test("CLK-003 lỗi backend khi vào ca (ATT_054 IP) hiện thông báo, thẻ giữ nút Vào ca", async ({ page }) => {
  await staff(page)
  await mockApi(page, "/v1/attendance/me/today", { body: ok({ date: "2026-11-23", shift: SHIFT, record: null, canClockIn: true, canClockOut: false }) })
  await mockApi(page, "/v1/attendance/me/clock-in", { method: "POST", status: 400, body: fail("ATT_054", "Không được chấm công từ địa chỉ IP này.") })
  await page.goto("/dashboard")
  await page.getByTestId("clock-card").getByRole("button", { name: "Vào ca" }).click()
  await expect(page.getByText("Không được chấm công từ địa chỉ IP này.")).toBeVisible()
  await expect(page.getByTestId("clock-card").getByRole("button", { name: "Vào ca" })).toBeEnabled()
})

test("CLK-004 không có quyền ATTENDANCE_SELF: không hiện thẻ chấm công", async ({ page }) => {
  await mockLoggedIn(page, { permissions: [] })
  await mockApi(page, "/v1/org/announcements/my", { body: pageOf([]) })
  await mockApi(page, "/v1/reports/calendar", { body: ok([]) })
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByTestId("clock-card")).toHaveCount(0)
})
