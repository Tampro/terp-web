// @ts-check
/**
 * §5 my dashboard. Spec: report-service GET /v1/reports/my-dashboard → { today, parts: { myProfile, myShift,
 * myLeaveBalances, myLeaveApplications, myWarnings, myAwards, myInterviews, myDeals, myTickets, myAnnouncements, … } },
 * each {data, error}: COMMON_004 = no permission (card left out), EMP_001 / EMP_041 = no employee profile (said once),
 * NOT_AVAILABLE = no source yet (left out). Staff view shows it; the company dashboard has it as the "Của tôi" tab.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const MY = {
  today: "2026-11-23",
  parts: {
    myProfile: { data: { employeeId: "35", employeeNo: "E2E-0035", fullName: "E2E Lê Thị Bích", branch: { id: "24", name: "E2E HCM" }, department: { id: "22", name: "E2E Kế toán" }, designation: { id: "5", name: "E2E Kế toán viên" } }, error: null },
    myShift: { data: { id: "1", name: "E2E Ca sáng", startTime: "08:00:00", endTime: "17:00:00" }, error: null },
    myLeaveBalances: { data: [{ leaveType: { id: "1", name: "E2E Phép năm", color: "#22c55e" }, total: 12, used: 3, available: 9 }], error: null },
    myLeaveApplications: { data: { pendingApplications: 1, recentApplications: [{ id: "4", leaveType: { id: "1", name: "E2E Phép năm" }, startDate: "2026-11-26", endDate: "2026-11-27", totalDays: 2, status: "PENDING" }] }, error: null },
    myWarnings: { data: [{ id: "2", subject: "E2E Đi muộn", severity: { name: "E2E Nhẹ" }, warningDate: "2026-11-10", status: "APPROVED" }], error: null },
    myAwards: { data: [{ id: "3", awardType: { name: "E2E Nhân viên xuất sắc" }, awardDate: "2026-10-01", gift: "E2E Voucher" }], error: null },
    myInterviews: { data: [{ id: "6", candidate: { id: "9", fullName: "E2E Ứng viên Minh", jobTitle: "E2E Backend Dev" }, round: { name: "E2E Vòng 1" }, date: "2026-11-25", startTime: "09:30:00", status: "SCHEDULED" }], error: null },
    myDeals: { data: null, error: "COMMON_004" },
    myTickets: { data: { total: 3, open: 2, closed: 1 }, error: null },
    myAnnouncements: { data: [{ id: "1", title: "E2E Lịch nghỉ Tết", startDate: "2026-11-22" }], error: null },
    myAttendanceThisMonth: { data: null, error: "NOT_AVAILABLE" },
  },
  unavailable: { myDeals: "COMMON_004", myAttendanceThisMonth: "NOT_AVAILABLE" },
}

/** @param {import('@playwright/test').Page} page @param {string[]} permissions */
async function open(page, permissions) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/reports/dashboard", { body: ok({}) })
  await mockApi(page, "/v1/reports/hr-dashboard", { body: ok({}) })
  await mockApi(page, "/v1/reports/calendar", { body: ok({ upcoming: [] }) })
  const my = await mockApi(page, "/v1/reports/my-dashboard", { body: ok(MY) })
  await page.goto("/dashboard")
  return my
}

test("MYDASH-001 nhân viên: hồ sơ, ca hôm nay, ngày phép, đơn nghỉ, phỏng vấn, cảnh cáo, khen thưởng, yêu cầu @smoke", async ({ page }) => {
  await open(page, [])
  const box = page.getByTestId("my-dashboard")
  await expect(box.getByTestId("my-profile")).toContainText("E2E Lê Thị Bích")
  await expect(box.getByTestId("my-profile")).toContainText("E2E-0035 · E2E Kế toán viên · E2E Kế toán · E2E HCM")
  await expect(box.getByTestId("my-shift")).toContainText("E2E Ca sáng · 08:00–17:00")
  await expect(box.getByTestId("my-balances")).toContainText("Còn 9/12 ngày")
  await expect(box.getByTestId("my-pending-leaves")).toHaveText("1")
  await expect(box.getByText("26/11/2026 – 27/11/2026 · 2 ngày")).toBeVisible()
  await expect(box.getByText("E2E Ứng viên Minh")).toBeVisible()
  await expect(box.getByText("Đã lên lịch")).toBeVisible()
  await expect(box.getByText("E2E Đi muộn")).toBeVisible()
  await expect(box.getByText("E2E Nhân viên xuất sắc")).toBeVisible()
  await expect(box.getByTestId("my-tickets")).toHaveText("2")
  await expect(box.getByText("E2E Lịch nghỉ Tết")).toBeVisible()
  // no permission (CRM) and no source yet: left out, no "no permission" noise
  await expect(box.getByTestId("my-deals")).toHaveCount(0)
  await expect(box.getByText("Bạn không có quyền xem mục này.")).toHaveCount(0)
  await expect(box.getByTestId("my-no-profile")).toHaveCount(0)
})

test("MYDASH-002 dashboard công ty: tab Của tôi chỉ tải khi mở", async ({ page }) => {
  const my = await open(page, ["EMPLOYEE_VIEW"])
  await expect(page.getByRole("tab", { name: "Nhân sự" })).toBeVisible()
  expect(my.length).toBe(0)
  await page.getByRole("tab", { name: "Của tôi" }).click()
  await expect(page.getByTestId("my-profile")).toContainText("E2E Lê Thị Bích")
  expect(my.length).toBe(1)
})
