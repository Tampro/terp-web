// @ts-check
/**
 * Calendar, video meetings, timesheets (manual §11.3–11.5).
 * Spec sources: report-service GET /reports/calendar?from&to&kinds (≤ 62 days); meeting-service ZoomMeetingController
 * (MeetingForm, /status, /start), ZoomSettingController (secret write-only, /test), GET /zoom/status;
 * attendance-service TimesheetController (GET /timesheets/month, EntryForm: 15 min to 24 h, ATT_053 / ATT_031).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const EMPLOYEES = [{ id: "301", fullName: "E2E Nhân viên", employeeCode: "E01" }]

test("CAL-001 lịch: tháng có sự kiện, lọc loại gửi kinds, chuyển sang xem ngày @smoke", async ({ page }) => {
  await mockLoggedIn(page, { permissions: [] })
  const cal = await mockApi(page, "/v1/reports/calendar", {
    body: ok({
      events: [{ kind: "PROJECT_TASK", id: "1", title: "E2E Homepage", start: "2026-11-27", end: "2026-11-27", allDay: true }],
      counts: { PROJECT_TASK: 1 },
      unavailable: { LEAVE: "COMMON_004" },
    }),
  })
  await page.goto("/calendar?date=2026-11-15")
  await expect(page.getByTestId("calendar-title")).toContainText("2026")
  await expect(page.locator("[data-date='2026-11-27']")).toContainText("E2E Homepage")
  const first = cal.requests[0].url.searchParams
  expect(first.get("from")).toBe("2026-10-26") // Monday of the first grid week
  expect(first.get("to")).toBe("2026-12-06") // 6 weeks
  await page.getByRole("checkbox").nth(8).click() // Project tasks
  await expect.poll(() => cal.requests.at(-1)?.url.searchParams.get("kinds")).toBe("PROJECT_TASK")
  await page.locator("[data-date='2026-11-27']").getByRole("button", { name: "27" }).click()
  await expect(page).toHaveURL(/view=day/)
  await expect.poll(() => cal.requests.at(-1)?.url.searchParams.get("from")).toBe("2026-11-27")
})

test("ZM-001 Zoom chưa cấu hình: thông báo, không lên lịch được; cài đặt gửi secret khi nhập", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["ZOOM_VIEW", "ZOOM_MANAGE"] })
  await mockApi(page, "/v1/meeting/zoom/status", { body: ok({ configured: false, enabled: false }) })
  await mockApi(page, "/v1/meeting/zoom/meetings", { method: "GET", body: ok([]) })
  await mockApi(page, "/v1/employees", { body: pageOf(EMPLOYEES) })
  await mockApi(page, "/v1/meeting/zoom/settings", { method: "GET", body: ok({ accountId: "", clientId: "", clientSecretSet: false, verified: false }) })
  const save = await mockApi(page, "/v1/meeting/zoom/settings", { method: "PUT", body: ok({}) })
  const test_ = await mockApi(page, "/v1/meeting/zoom/settings/test", { method: "POST", body: ok({ verified: true }) })
  await page.goto("/meetings")
  await expect(page.getByText("Chưa thiết lập Zoom")).toBeVisible()
  await expect(page.getByRole("button", { name: "Lên lịch họp" })).toBeDisabled()
  await page.getByRole("button", { name: "Cài đặt Zoom" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Account ID").fill("acc")
  await dialog.getByLabel("Client ID").fill("cli")
  await dialog.getByRole("button", { name: "Lưu & kiểm tra" }).click()
  await expect(dialog.getByText("Bắt buộc")).toBeVisible() // no stored secret yet
  await dialog.getByLabel("Client Secret").fill("s3cret")
  await dialog.getByRole("button", { name: "Lưu & kiểm tra" }).click()
  await expect.poll(() => test_.length).toBe(1)
  expect(save[0]).toEqual({ accountId: "acc", clientId: "cli", clientSecret: "s3cret" })
})

test("ZM-002 lên lịch họp: thời lượng 1..1440, mật khẩu theo mẫu, gửi MeetingForm; thẻ đếm theo trạng thái", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["ZOOM_VIEW", "ZOOM_MANAGE"] })
  await mockApi(page, "/v1/meeting/zoom/status", { body: ok({ configured: true, enabled: true }) })
  await mockApi(page, "/v1/meeting/zoom/meetings", {
    method: "GET",
    body: ok([{ id: "1", topic: "E2E Sync", startDate: "2026-11-25", startTime: "09:00:00", endTime: "09:30:00", status: "SCHEDULED", joinUrl: "https://zoom.us/j/1", invitees: [] }]),
  })
  await mockApi(page, "/v1/employees", { body: pageOf(EMPLOYEES) })
  const create = await mockApi(page, "/v1/meeting/zoom/meetings", { method: "POST", body: ok({}) })
  await page.goto("/meetings")
  await expect(page.getByRole("button", { name: /Đã lên lịch/ })).toContainText("1")
  await page.getByRole("button", { name: "Lên lịch họp" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tiêu đề").fill("E2E Kickoff")
  await dialog.getByLabel("Ngày").fill("2026-11-30")
  await dialog.getByLabel("Thời lượng (phút)").fill("2000")
  await dialog.getByLabel("Mật khẩu").fill("bad pass!")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Nhập từ 1 đến 1440 phút")).toBeVisible()
  await expect(dialog.getByText("Tối đa 10 ký tự")).toBeVisible()
  await dialog.getByLabel("Thời lượng (phút)").fill("45")
  await dialog.getByLabel("Mật khẩu").fill("")
  await dialog.getByRole("checkbox", { name: "E2E Nhân viên" }).click()
  await dialog.getByRole("switch", { name: "Phòng chờ" }).click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    topic: "E2E Kickoff",
    startDate: "2026-11-30",
    startTime: "09:00",
    durationMinutes: 45,
    inviteeIds: [301],
    agenda: null,
    hostVideo: false,
    participantVideo: false,
    waitingRoom: true,
    autoRecording: "NONE",
  })
})

test("TS-001 bảng chấm giờ: lưới tháng có tổng, bản ghi 15 phút..24 giờ, gửi EntryForm", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["ATTENDANCE_VIEW", "ATTENDANCE_MANAGE"] })
  await mockApi(page, "/v1/employees", { body: pageOf(EMPLOYEES) })
  const days = Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, hours: i === 2 ? 8 : 0, entries: i === 2 ? 1 : 0, status: i === 2 ? "APPROVED" : null }))
  const month = await mockApi(page, "/v1/attendance/timesheets/month", {
    body: ok({ year: 2026, month: 11, rows: [{ employeeId: "301", fullName: "E2E Nhân viên", days, total: 8 }], dayTotals: days.map((d) => d.hours), total: 8, counts: { all: 1, pending: 0, approved: 1, rejected: 0 }, page: 0, size: 20, totalElements: 1 }),
  })
  const create = await mockApi(page, "/v1/attendance/timesheets/entries", { method: "POST", body: ok({}) })
  await page.goto("/timesheets?year=2026&month=11")
  await expect.poll(() => month.requests[0]?.url.searchParams.get("month")).toBe("11")
  await expect(page.getByTestId("timesheet-total")).toHaveText("8")
  await expect(page.getByText("Đã duyệt: 1")).toBeVisible()
  await page.getByRole("button", { name: "E2E Nhân viên ngày 2026-11-05" }).click() // empty cell → new entry for that day
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("Ngày")).toHaveValue("2026-11-05")
  await dialog.getByLabel("Giờ", { exact: true }).fill("0")
  await dialog.getByLabel("Phút").fill("10")
  await dialog.getByLabel("Ghi chú").fill("E2E docs")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Mỗi bản ghi từ 15 phút đến 24 giờ")).toBeVisible()
  expect(create).toHaveLength(0)
  await dialog.getByLabel("Giờ", { exact: true }).fill("2")
  await dialog.getByLabel("Phút").fill("30")
  await dialog.getByRole("combobox", { name: "Loại" }).click()
  await page.getByRole("option", { name: "Dự án" }).click()
  await dialog.getByLabel("Dự án").fill("E2E Website")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ employeeId: 301, date: "2026-11-05", hours: 2, minutes: 30, type: "PROJECT", project: "E2E Website", description: "E2E docs" })
})

/** @param {import('@playwright/test').Page} page @param {string[]} permissions */
async function timesheetMonth(page, permissions) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/employees", { body: pageOf(EMPLOYEES) })
  await mockApi(page, "/v1/attendance/timesheets/month", {
    body: ok({ year: 2026, month: 2, rows: [], dayTotals: [], total: 0, counts: { all: 0, pending: 0, approved: 0, rejected: 0 }, page: 0, size: 20, totalElements: 0 }),
  })
}

// GET /timesheets/export?from&to&employeeId (.xlsx, ATTENDANCE_VIEW); import is ATTENDANCE_MANAGE only
test("TS-010 xuất Excel tháng đang xem (from/to/employeeId); chỉ xem thì không có Nhập từ tệp", async ({ page }) => {
  await timesheetMonth(page, ["ATTENDANCE_VIEW"])
  /** @type {URL[]} */
  const exports = []
  await page.route("**/api/v1/attendance/timesheets/export**", (r) => {
    exports.push(new URL(r.request().url()))
    return r.fulfill({ status: 200, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: Buffer.from("PK e2e") })
  })
  await page.goto("/timesheets?year=2026&month=2&employeeId=301")
  await expect(page.getByRole("button", { name: "Nhập từ tệp" })).toHaveCount(0)
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Xuất Excel" }).click()])
  expect(dl.suggestedFilename()).toBe("timesheets-2026-02.xlsx")
  expect(exports[0].searchParams.get("from")).toBe("2026-02-01")
  expect(exports[0].searchParams.get("to")).toBe("2026-02-28")
  expect(exports[0].searchParams.get("employeeId")).toBe("301")
})

// POST /timesheets/import (multipart "file") → ImportResult {total, created, errors[{row, code, message}]}
test("TS-011 nhập từ tệp: tải mẫu, gửi multipart, hiện kết quả và dòng lỗi; tệp > 5 MB bị chặn trước khi gửi", async ({ page }) => {
  await timesheetMonth(page, ["ATTENDANCE_VIEW", "ATTENDANCE_MANAGE"])
  await page.route("**/api/v1/attendance/timesheets/import-template", (r) =>
    r.fulfill({ status: 200, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: Buffer.from("PK e2e") }),
  )
  const imp = await mockApi(page, "/v1/attendance/timesheets/import", {
    method: "POST",
    body: ok({ total: 3, created: 2, errors: [{ row: 4, code: "ATT_015", message: "E2E dòng 4: nhân viên không hợp lệ" }] }),
  })
  await page.goto("/timesheets?year=2026&month=2")
  await page.getByRole("button", { name: "Nhập từ tệp" }).click()
  const dlg = page.getByRole("dialog")
  const [tpl] = await Promise.all([page.waitForEvent("download"), dlg.getByRole("button", { name: "Tải tệp mẫu" }).click()])
  expect(tpl.suggestedFilename()).toBe("timesheet-import-template.xlsx")
  await expect(dlg.getByRole("button", { name: "Nhập", exact: true })).toBeDisabled()
  await dlg.getByLabel("Tệp cần nhập").setInputFiles({ name: "big.csv", mimeType: "text/csv", buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 65) })
  await dlg.getByRole("button", { name: "Nhập", exact: true }).click()
  await expect(dlg.getByText("Tệp lớn hơn 5 MB.")).toBeVisible()
  expect(imp.length).toBe(0)
  await dlg.getByLabel("Tệp cần nhập").setInputFiles({ name: "e2e.csv", mimeType: "text/csv", buffer: Buffer.from("Employee,Date,Hours\nE01,2026-02-02,2\n") })
  await dlg.getByRole("button", { name: "Nhập", exact: true }).click()
  await expect(dlg.getByTestId("timesheet-import-result")).toContainText("Đã nhập 2/3 dòng")
  await expect(dlg.getByRole("row").filter({ hasText: "4" })).toContainText("ATT_015")
  expect(imp.requests[0].headers["content-type"]).toMatch(/^multipart\/form-data/)
})

test("ZM-010 cuộc họp: nút Lịch mở lịch chung lọc cuộc họp video", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["ZOOM_VIEW"] })
  await mockApi(page, "/v1/meeting/zoom/status", { body: ok({ configured: true, enabled: true }) })
  await mockApi(page, "/v1/meeting/zoom/meetings", { method: "GET", body: ok([]) })
  await mockApi(page, "/v1/reports/calendar", { body: ok({ events: [], counts: {}, unavailable: {} }) })
  await page.goto("/meetings")
  await page.locator('main a[href="/calendar?kinds=ZOOM_MEETING"]').click()
  await expect(page).toHaveURL(/\/calendar\?kinds=ZOOM_MEETING/)
})
