// @ts-check
/**
 * Company dashboards + Staff view (manual §5: HRM, Recruitment, role views).
 * Spec sources: report-service GET /reports/dashboard?year= (CompanyDashboard: each Part = data or error,
 * COMMON_004 = no permission), GET /reports/calendar?from&to (≤ 62 days, upcoming); employee-service
 * GET /org/announcements/my (isAuthenticated); permissions EMPLOYEE_VIEW / ATTENDANCE_VIEW / LEAVE_VIEW /
 * RECRUITMENT_VIEW from the dashboard controllers' @PreAuthorize.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const YEAR = new Date().getFullYear()

const DASHBOARD = {
  today: "2026-11-22",
  year: YEAR,
  employees: {
    data: {
      totalEmployees: 40,
      activeEmployees: 38,
      newThisMonth: 3,
      branches: 2,
      departments: 5,
      promotions: 1,
      terminations: 2,
      hiringTrend: [1, 0, 2, 0, 0, 1, 0, 0, 3, 0, 4, 1],
      byDepartment: [
        { departmentId: "1", name: "E2E Phòng Kỹ thuật & Vận hành", employees: 20 },
        { departmentId: null, name: null, employees: 4 },
      ],
      birthdaysToday: [{ employeeId: "5", fullName: "E2E Nguyễn Thị Hồng", designation: "QA" }],
    },
  },
  attendance: {
    data: {
      presentToday: 30,
      activeEmployees: 40,
      attendanceRateThisMonth: 91.25,
      absentToday: 2,
      onLeaveToday: 3,
      notMarkedToday: 5,
      last7Days: [{ date: "2026-11-21", present: 30, onLeave: 2, absent: 1 }],
    },
  },
  leave: {
    data: {
      pending: 2,
      todayLeaves: [{ applicationId: "8", employee: { fullName: "E2E O'Brien" }, leaveType: "Annual", endDate: "2026-11-23" }],
      month: { pending: 2, approved: 4, rejected: 1, total: 7 },
    },
  },
  recentLeaves: {
    data: [{ id: "8", employee: { fullName: "E2E 김민수" }, leaveType: { name: "Sick" }, startDate: "2026-11-20", endDate: "2026-11-21", status: "PENDING" }],
  },
  payroll: { data: null, error: "COMMON_004" },
  recruitment: {
    data: {
      activeJobs: 4,
      openPositions: 9,
      careerSlug: "e2e-acme",
      pipeline: { NEW: 5, SCREENING: 3, INTERVIEW: 2, OFFER: 1, HIRED: 1, REJECTED: 2 },
      totalCandidates: 14,
      scheduledInterviews: 2,
      completedOnboardings: 1,
      funnel: [{ stage: "NEW", reached: 14, percentOfTotal: 100 }, { stage: "HIRED", reached: 1, percentOfTotal: 7.1 }],
    },
  },
  recentCandidates: { data: [{ id: "3", fullName: "E2E Trần Văn Minh", job: { title: "E2E Backend Dev" }, status: "INTERVIEW" }] },
  announcements: { data: [{ id: "1", title: "E2E Nghỉ Tết", startDate: "2026-11-20", highPriority: true }] },
}

const CALENDAR = {
  upcoming: [{ kind: "HOLIDAY", id: "h1", title: "E2E Ngày Nhà giáo", start: "2026-11-25", end: "2026-11-25", allDay: true }],
  unavailable: {},
}

/** @param {import('@playwright/test').Page} page @param {string[]} permissions */
async function open(page, permissions, dashboard = DASHBOARD) {
  await mockLoggedIn(page, { permissions })
  const dash = await mockApi(page, "/v1/reports/dashboard", { body: ok(dashboard) })
  const cal = await mockApi(page, "/v1/reports/calendar", { body: ok(CALENDAR) })
  await page.goto("/dashboard")
  return { dash, cal }
}

test("CDASH-001 HRM: banner tỷ lệ hôm nay, thẻ số liệu, danh sách; gọi dashboard với năm hiện tại @smoke", async ({ page }) => {
  const { dash, cal } = await open(page, ["EMPLOYEE_VIEW", "ATTENDANCE_VIEW", "LEAVE_VIEW"])
  await expect(page.getByTestId("cdash.rateToday")).toHaveText("75%") // 30 / 40
  await expect(page.getByText("30/40 nhân viên có mặt")).toBeVisible()
  await expect(page.getByTestId("cdash.employees")).toHaveText("40")
  await expect(page.getByTestId("cdash.absent")).toHaveText("2")
  await expect(page.getByTestId("cdash.notMarked")).toHaveText("5")
  await expect(page.getByText("E2E Phòng Kỹ thuật & Vận hành")).toBeVisible()
  await expect(page.getByText("Chưa có phòng ban")).toBeVisible() // departmentId null
  await expect(page.getByText("E2E O'Brien")).toBeVisible()
  await expect(page.getByText("E2E 김민수")).toBeVisible()
  await expect(page.getByText("E2E Ngày Nhà giáo")).toBeVisible()
  // only HRM: tabs Nhân sự + Của tôi (open to every company user), no recruitment figures
  await expect(page.getByRole("tab")).toHaveText(["Nhân sự", "Của tôi"])
  await expect(page.getByTestId("cdash.activeJobs")).toHaveCount(0)
  expect(dash.requests[0].url.searchParams.get("year")).toBe(String(YEAR))
  const from = cal.requests[0].url.searchParams.get("from") ?? ""
  const to = cal.requests[0].url.searchParams.get("to") ?? ""
  expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBeLessThanOrEqual(62) // REP_001
})

test("CDASH-002 thẻ không có quyền (COMMON_004) hiện thông báo, các thẻ khác vẫn hiện", async ({ page }) => {
  await open(page, ["EMPLOYEE_VIEW"])
  const payroll = page.getByText("Lương thực trả tháng này").locator("xpath=ancestor::*[@data-slot='card'][1]")
  await expect(payroll.getByRole("note")).toHaveText("Bạn không có quyền xem mục này.")
  await expect(page.getByTestId("cdash.employees")).toHaveText("40")
})

test("CDASH-003 có cả hai quyền: tab Tuyển dụng hiện pipeline, phễu, ứng viên gần đây", async ({ page }) => {
  await open(page, ["ATTENDANCE_VIEW", "RECRUITMENT_VIEW"])
  await page.getByRole("tab", { name: "Tuyển dụng" }).click()
  await expect(page.getByTestId("cdash.activeJobs")).toHaveText("4")
  await expect(page.getByText("9 vị trí cần tuyển")).toBeVisible()
  await expect(page.getByTestId("cdash.candidates")).toHaveText("14")
  await expect(page.getByTestId("cdash.career")).toHaveText("Trang tuyển dụng: /e2e-acme")
  await expect(page.getByText("E2E Trần Văn Minh")).toBeVisible()
  await expect(page.getByText("14 · 100%")).toBeVisible()
})

test("CDASH-004 đổi năm → gọi lại dashboard với year mới", async ({ page }) => {
  const { dash } = await open(page, ["EMPLOYEE_VIEW"])
  await expect(page.getByTestId("cdash.employees")).toHaveText("40")
  await page.getByRole("combobox", { name: "Năm" }).click()
  await page.getByRole("option", { name: String(YEAR - 1) }).click()
  await expect.poll(() => dash.requests.at(-1)?.url.searchParams.get("year")).toBe(String(YEAR - 1))
})

test("CDASH-005 lỗi backend → thông báo lỗi, không hiện undefined/NaN", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["RECRUITMENT_VIEW"] })
  await mockApi(page, "/v1/reports/dashboard", { status: 500, body: { result: false, code: "COMMON_500", message: "E2E lỗi máy chủ" } })
  await mockApi(page, "/v1/reports/calendar", { body: ok(CALENDAR) })
  await page.goto("/dashboard")
  await expect(page.getByText("E2E lỗi máy chủ")).toBeVisible()
  await expect(page.getByText(/undefined|NaN/)).toHaveCount(0)
})

test("STAFF-001 không có quyền HRM/Tuyển dụng → view Staff: thông báo của tôi, sự kiện; không gọi /reports/dashboard", async ({ page }) => {
  await mockLoggedIn(page, { permissions: [] })
  const dash = await mockApi(page, "/v1/reports/dashboard", { body: ok(DASHBOARD) })
  await mockApi(page, "/v1/reports/calendar", { body: ok(CALENDAR) })
  const my = await mockApi(page, "/v1/reports/my-dashboard", {
    body: ok({ parts: { myAnnouncements: { data: [{ id: "2", title: "E2E Lịch nghỉ cuối năm", shortDescription: "E2E mô tả", startDate: "2026-11-01" }] } } }),
  })
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Tester" })).toBeVisible()
  await expect(page.getByText("E2E Lịch nghỉ cuối năm")).toBeVisible()
  await expect(page.getByText("E2E Ngày Nhà giáo")).toBeVisible()
  expect(my.requests).toHaveLength(1)
  expect(dash.requests).toHaveLength(0)
})

// Found against the real backend: an account without an employee profile got a generic "not available".
test("STAFF-002 không có hồ sơ nhân viên (EMP_041 / EMP_001) → báo một lần, không hiện các thẻ nhân sự", async ({ page }) => {
  await mockLoggedIn(page, { permissions: [] })
  await mockApi(page, "/v1/reports/calendar", { body: ok(CALENDAR) })
  const none = { data: null, error: "EMP_041" }
  await mockApi(page, "/v1/reports/my-dashboard", {
    body: ok({ parts: { myProfile: { data: null, error: "EMP_001" }, myAnnouncements: none, myWarnings: none, myAwards: none } }),
  })
  await page.goto("/dashboard")
  await expect(page.getByTestId("my-no-profile")).toContainText("chưa được liên kết với hồ sơ nhân viên")
  await expect(page.getByText("Thông báo của tôi")).toHaveCount(0)
  await expect(page.getByText("Hiện chưa lấy được dữ liệu.")).toHaveCount(0)
  await expect(page.getByText("E2E Ngày Nhà giáo")).toBeVisible() // the calendar card still shows
})

test("CDASH-006 thao tác nhanh HRM theo quyền; tab Tuyển dụng có nút sao chép link cổng tuyển dụng", async ({ page }) => {
  await open(page, ["EMPLOYEE_VIEW", "EMPLOYEE_CREATE", "LEAVE_VIEW", "RECRUITMENT_VIEW"])
  const qa = page.getByTestId("hrm-quick-actions")
  await expect(qa.getByRole("link")).toHaveText(["Thêm nhân viên", "Nộp đơn nghỉ phép"]) // no payroll / lifecycle rights
  await expect(qa.getByRole("link", { name: "Thêm nhân viên" })).toHaveAttribute("href", "/hrm/employees")
  await page.getByRole("tab", { name: "Tuyển dụng" }).click()
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.getByTestId("copy-career-link").click()
  await expect(page.getByTestId("copy-career-link")).toHaveText("Đã sao chép")
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/careers\/e2e-acme$/)
})
