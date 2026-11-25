// @ts-check
/**
 * HRM (manual §15). Spec sources: employee-service EmployeeController (EmployeeCreateForm {email, password, profile:
 * ProfileForm, documents}; type-counts {all, byType}), org/* (BranchForm), lifecycle/* (catalogs at
 * /lifecycle/catalogs/{slug}; complaint AssignForm; resignation StatusForm {status ACCEPTED|REJECTED + exit interview});
 * attendance-service (GET /attendance/records requires employeeId; calendar DayCell {status, late, ...}; leave
 * applications approve / reject DecisionForm {comments}); payroll-service (process, PayForm {bankAccountId, paymentDate},
 * entries and employee overtimes / loans are pages; SalaryForm {employeeId, basicSalary, components[{componentId,
 * value}], status}); document-service (approve DecisionForm {comment}; download → {url}).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = [
  "EMPLOYEE_VIEW", "EMPLOYEE_CREATE", "EMPLOYEE_UPDATE", "EMPLOYEE_DELETE", "ORG_VIEW", "ORG_MANAGE", "LIFECYCLE_VIEW", "LIFECYCLE_MANAGE",
  "ATTENDANCE_VIEW", "ATTENDANCE_MANAGE", "LEAVE_VIEW", "LEAVE_MANAGE", "PAYROLL_VIEW", "PAYROLL_MANAGE", "PAYROLL_PAY", "DOCUMENT_VIEW",
  "DOCUMENT_MANAGE", "ANNOUNCEMENT_VIEW", "ANNOUNCEMENT_MANAGE", "BANK_VIEW",
]
const EMP = { id: "35", employeeNo: "EMP000001", fullName: "E2E An", email: "an@example.com", status: "ACTIVE", employmentType: "FULL_TIME", dateOfJoining: "2026-11-01" }

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/org/branches/options", { body: ok([{ id: "24", name: "E2E HCM" }]) })
  await mockApi(page, "/v1/org/departments/options", { body: ok([{ id: "22", name: "E2E Accounting", branchId: "24" }]) })
  await mockApi(page, "/v1/org/designations/options", { body: ok([{ id: "23", name: "E2E Chief Accountant", departmentId: "22" }]) })
  await mockApi(page, "/v1/attendance/shifts/options", { body: ok([{ id: "7", name: "E2E Day shift" }]) })
  await mockApi(page, "/v1/org/document-types/options", { body: ok([{ id: "6", name: "E2E ID card" }]) })
}
/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("HR-001 nhân viên: tab theo loại có số đếm; wizard 6 bước, phòng ban mở theo chi nhánh, gửi EmployeeCreateForm @smoke", async ({ page }) => {
  await base(page)
  const list = await mockApi(page, "/v1/employees", { method: "GET", body: pageOf([EMP]) })
  await mockApi(page, "/v1/employees/type-counts", { body: ok({ all: 1, byType: { FULL_TIME: 1, PART_TIME: 0, CONTRACT: 0, INTERN: 0, TEMPORARY: 0 } }) })
  const create = await mockApi(page, "/v1/employees", { method: "POST", body: ok({ ...EMP, id: "36" }) })
  await page.goto("/hrm/employees")
  await expect(page.getByRole("tab", { name: "Toàn thời gian (1)" })).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "EMP000001" })).toContainText("E2E An")
  await page.getByRole("tab", { name: "Bán thời gian (0)" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("employmentType")).toBe("PART_TIME")

  await page.getByRole("button", { name: "Thêm nhân viên" }).click()
  const d = page.getByRole("dialog")
  const next = d.getByRole("button", { name: "Tiếp" })
  await expect(d).toContainText("Bước 1/6")
  await expect(next).toBeDisabled()
  await d.getByLabel("Họ tên *").fill("E2E Bình")
  await d.getByRole("combobox", { name: "Giới tính" }).click()
  await page.getByRole("option", { name: "Nữ" }).click()
  await next.click()
  await expect(d).toContainText("Bước 2/6")
  await d.getByLabel("Email đăng nhập *").fill("binh@example.com")
  await d.getByLabel("Mật khẩu ban đầu (tùy chọn)").fill("short")
  await expect(d.getByText("Tối thiểu 8 ký tự")).toBeVisible()
  await d.getByLabel("Mật khẩu ban đầu (tùy chọn)").fill("Secret@123")
  await d.getByRole("combobox", { name: "Loại hình" }).click()
  await page.getByRole("option", { name: "Bán thời gian" }).click()
  await expect(d.getByRole("combobox", { name: "Phòng ban" })).toHaveCount(0)
  await d.getByRole("combobox", { name: "Chi nhánh" }).click()
  await page.getByRole("option", { name: "E2E HCM" }).click()
  await d.getByRole("combobox", { name: "Phòng ban" }).click()
  await page.getByRole("option", { name: "E2E Accounting" }).click()
  await d.getByRole("combobox", { name: "Chức danh" }).click()
  await page.getByRole("option", { name: "E2E Chief Accountant" }).click()
  await next.click()
  await d.getByLabel("Thành phố").fill("Hà Nội")
  await next.click()
  await d.getByLabel("Số tài khoản").fill("0011")
  await next.click()
  await d.getByLabel("Lương cơ bản").fill("12000000")
  await d.getByLabel("Ngày mỗi tuần").fill("5.5")
  await expect(d.getByText("Số nguyên")).toBeVisible()
  await d.getByLabel("Ngày mỗi tuần").fill("5")
  await next.click()
  await expect(d).toContainText("Bước 6/6")
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    email: "binh@example.com",
    password: "Secret@123",
    documents: [],
    profile: {
      fullName: "E2E Bình",
      gender: "FEMALE",
      dateOfJoining: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      employmentType: "PART_TIME",
      status: "ACTIVE",
      branchId: 24,
      departmentId: 22,
      designationId: 23,
      city: "Hà Nội",
      banking: { accountNumber: "0011", baseSalary: 12000000, daysPerWeek: 5 },
    },
  })
})

test("HR-002 thiết lập: chi nhánh gửi BranchForm; danh mục cảnh cáo / khiếu nại dùng /lifecycle/catalogs/{slug}", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/org/branches", { method: "GET", body: pageOf([]) })
  const branch = await mockApi(page, "/v1/org/branches", { method: "POST", body: ok({ id: "1" }) })
  const complaints = await mockApi(page, "/v1/lifecycle/catalogs/complaint-types", { method: "GET", body: pageOf([{ id: "33", name: "E2E Workplace", status: "ACTIVE" }]) })
  await mockApi(page, "/v1/lifecycle/catalogs/warning-types", { method: "GET", body: pageOf([]) })
  await page.goto("/hrm/setup")
  await page.getByRole("button", { name: "Thêm chi nhánh" }).click()
  const d = page.getByRole("dialog")
  await d.getByLabel("Tên *").fill("E2E Hà Nội")
  await d.getByLabel("Email").fill("bad")
  await d.getByLabel("Email").fill("hn@example.com")
  await d.getByLabel("Thành phố").fill("Hà Nội")
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => branch.length).toBe(1)
  expect(branch[0]).toEqual({ name: "E2E Hà Nội", city: "Hà Nội", email: "hn@example.com", status: "ACTIVE" })
  await page.getByRole("tab", { name: "Loại cảnh cáo, chấm dứt & khiếu nại" }).click()
  await page.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "Loại khiếu nại" }).click()
  await expect(page.getByRole("row").filter({ hasText: "E2E Workplace" })).toBeVisible()
  expect(complaints.length).toBeGreaterThan(0)
})

test("HR-010 chấm công: bản ghi chỉ tải khi chọn nhân viên; lưới tháng hiện trạng thái và đi muộn", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/employees", { method: "GET", body: pageOf([EMP]) })
  const records = await mockApi(page, "/v1/attendance/records", { method: "GET", body: pageOf([{ id: "8", employeeId: "35", date: "2026-11-20", clockIn: "08:25:00", clockOut: "17:30:00", status: "PRESENT", late: true, totalHours: 8.08 }]) })
  await mockApi(page, "/v1/attendance/records/calendar", {
    body: ok({
      year: 2026,
      month: 11,
      rows: [{ employeeId: "35", fullName: "E2E An", designation: "E2E Chief", attended: 1, workingDays: 21, days: [{ date: "2026-11-01", status: "DAY_OFF", weekend: true }, { date: "2026-11-02", status: "PRESENT", late: true, clockIn: "08:25:00", clockOut: "17:30:00" }, { date: "2026-11-03", status: "ABSENT" }] }],
    }),
  })
  await page.goto("/hrm/attendance?month=2026-11")
  await expect(page.getByTestId("grid-month")).toHaveText("11/2026")
  await expect(page.getByLabel(/E2E An 2026-11-02: Có mặt · 08:25–17:30 · Đi muộn/)).toHaveText("P")
  await expect(page.getByLabel(/E2E An 2026-11-03: Vắng/)).toHaveText("A")
  await expect(page.getByRole("row").filter({ hasText: "E2E An" })).toContainText("1/21")
  await page.getByRole("tab", { name: "Bản ghi" }).click()
  await expect(page.getByText("Chọn nhân viên để xem bản ghi.")).toBeVisible()
  expect(records.length).toBe(0)
  await page.getByRole("combobox", { name: "Nhân viên" }).click()
  await page.getByRole("option", { name: "E2E An (EMP000001)" }).click()
  await expect(page.getByRole("row").filter({ hasText: "20/11/2026" })).toContainText("Đi muộn")
  expect(records.requests[0].url.searchParams.get("employeeId")).toBe("35")
})

test("HR-020 nghỉ phép: duyệt đơn kèm nhận xét (DecisionForm {comments}); số dư tổng / đã dùng / còn lại", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/attendance/leave/types/options", { body: ok([{ id: "1", name: "E2E Annual", color: "#2563EB" }]) })
  await mockApi(page, "/v1/attendance/leave/applications", {
    method: "GET",
    body: pageOf([{ id: "4", employee: { id: "35", fullName: "E2E An" }, leaveType: { id: "1", name: "E2E Annual", color: "#2563EB" }, startDate: "2026-11-26", endDate: "2026-11-27", days: 2, reason: "E2E family", status: "PENDING" }]),
  })
  const approve = await mockApi(page, "/v1/attendance/leave/applications/4/approve", { method: "PUT", body: ok({}) })
  await mockApi(page, "/v1/attendance/leave/balances", { body: ok({ year: 2026, cards: [{ employee: { id: "35", fullName: "E2E An" }, balances: [{ leaveType: { id: "1", name: "E2E Annual" }, total: 12, used: 2, available: 10 }] }], page: 0, size: 20, totalElements: 1 }) })
  await page.goto("/hrm/leave")
  await menu(page, "E2E An (E2E Annual)").click()
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  const d = page.getByRole("dialog")
  await d.getByLabel("Nhận xét").fill("E2E ok")
  await d.getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approve.length).toBe(1)
  expect(approve[0]).toEqual({ comments: "E2E ok" })
  await page.getByRole("tab", { name: "Số dư" }).click()
  await expect(page.getByRole("row").filter({ hasText: "E2E An" })).toContainText(/12\s*2\s*10/)
})

test("HR-030 lương: tính lương qua xác nhận, trả lương gửi PayForm, chi tiết kỳ suy ra phụ cấp từ totalEarnings", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/bank-accounts", { body: pageOf([{ id: "3", bankName: "E2E VCB", accountNumber: "0002" }]) })
  const runs = [
    { id: "6", title: "E2E Draft run", frequency: "MONTHLY", periodStart: "2026-12-01", periodEnd: "2026-12-31", payDate: "2026-12-31", status: "DRAFT", paymentStatus: "UNPAID" },
    { id: "7", title: "E2E November", frequency: "MONTHLY", periodStart: "2026-11-01", periodEnd: "2026-11-30", payDate: "2026-11-30", status: "COMPLETED", paymentStatus: "UNPAID", grossPay: 15730000, netPay: 14530000, employeeCount: 1 },
  ]
  await mockApi(page, "/v1/payroll/runs", { method: "GET", body: pageOf(runs) })
  const process = await mockApi(page, "/v1/payroll/runs/6/process", { method: "POST", body: ok({}) })
  const pay = await mockApi(page, "/v1/payroll/runs/7/pay", { method: "POST", body: ok({}) })
  await mockApi(page, "/v1/payroll/runs/7/entries", { body: pageOf([{ id: "1", employee: { fullName: "E2E An" }, basicSalary: 15000000, totalEarnings: 15730000, totalDeductions: 1200000, grossPay: 15730000, netPay: 14530000, lines: null, workingDays: 21, presentDays: 3 }]) })
  await page.goto("/hrm/payroll")
  await menu(page, "E2E Draft run").click()
  await expect(page.getByRole("menuitem", { name: "Trả lương" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Tính lương" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Tính lương" }).click()
  await expect.poll(() => process.requests.length).toBe(1)
  await menu(page, "E2E November").click()
  await page.getByRole("menuitem", { name: "Trả lương" }).click()
  const d = page.getByRole("dialog")
  await d.getByRole("combobox", { name: "Tài khoản ngân hàng" }).click()
  await page.getByRole("option", { name: "E2E VCB · 0002" }).click()
  await d.getByLabel("Ngày thanh toán").fill("2026-11-30")
  await d.getByRole("button", { name: "Trả lương" }).click()
  await expect.poll(() => pay.length).toBe(1)
  expect(pay[0]).toEqual({ bankAccountId: 3, paymentDate: "2026-11-30" })
  await page.getByRole("button", { name: "E2E November", exact: true }).click()
  const row = page.getByRole("dialog").getByRole("row").filter({ hasText: "E2E An" })
  await expect(row).toContainText("730.000")
  await expect(page.getByTestId("run-net")).toContainText("14.530.000")
})

test("HR-031 thiết lập lương: khoản trùng bị chặn, gửi SalaryForm; tăng ca / khoản vay đọc dạng trang", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/employees", { method: "GET", body: pageOf([EMP]) })
  await mockApi(page, "/v1/payroll/salaries", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/payroll/components/options", {
    body: ok([
      { id: "1", name: "E2E Lunch", type: "EARNING", calculation: "FIXED", value: 730000 },
      { id: "2", name: "E2E Insurance", type: "DEDUCTION", calculation: "PERCENTAGE", value: 8 },
    ]),
  })
  const save = await mockApi(page, "/v1/payroll/salaries", { method: "POST", body: ok({ id: "13" }) })
  await mockApi(page, "/v1/payroll/employees/35/overtimes", { body: pageOf([{ id: "1", title: "E2E Year end", days: 1, hours: 4, amount: 400000, status: "PENDING" }]) })
  await mockApi(page, "/v1/payroll/employees/35/loans", { body: pageOf([]) })
  await page.goto("/hrm/payroll?tab=salaries")
  await page.getByRole("button", { name: "Thêm lương nhân viên" }).click()
  const d = page.getByRole("dialog")
  await d.getByRole("combobox", { name: "Nhân viên" }).click()
  await page.getByRole("option", { name: "E2E An (EMP000001)" }).click()
  await d.getByLabel("Lương cơ bản").fill("15000000")
  await d.getByRole("button", { name: "Thêm khoản" }).click()
  await d.getByRole("button", { name: "Thêm khoản" }).click()
  for (const n of [1, 2]) {
    await d.getByRole("combobox", { name: `Khoản ${n}` }).click()
    await page.getByRole("option", { name: /E2E Lunch/ }).click()
  }
  await expect(d.getByText("Một khoản bị chọn trùng.")).toBeVisible()
  await expect(d.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
  await d.getByRole("combobox", { name: "Khoản 2" }).click()
  await page.getByRole("option", { name: /E2E Insurance/ }).click()
  await d.getByLabel("Giá trị khoản 2").fill("10")
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ employeeId: 35, basicSalary: 15000000, status: "ACTIVE", components: [{ componentId: 1 }, { componentId: 2, value: 10 }] })
  await expect(d.getByRole("row").filter({ hasText: "E2E Year end" })).toContainText("Chờ duyệt")
})

test("HR-040 tài liệu: duyệt kèm nhận xét; chỉ tải được khi đã duyệt và mở link {url}", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/document/categories/options", { body: ok([{ id: "6", name: "E2E Policy" }]) })
  await mockApi(page, "/v1/document/documents", {
    method: "GET",
    body: pageOf([
      { id: "1", title: "E2E Handbook", category: { id: "6", name: "E2E Policy" }, status: "PENDING" },
      { id: "2", title: "E2E Code", category: { id: "6", name: "E2E Policy" }, status: "APPROVED" },
    ]),
  })
  const approve = await mockApi(page, "/v1/document/documents/1/approve", { method: "POST", body: ok({}) })
  await mockApi(page, "/v1/document/documents/2/download", { body: ok({ url: "https://files.example.com/e2e-code.pdf" }) })
  // record window.open instead of following the link out of the sandbox
  await page.addInitScript(() => {
    const w = /** @type {any} */ (window)
    w.__opened = []
    w.open = (/** @type {string} */ url) => (w.__opened.push(url), null)
  })
  await page.goto("/hrm/documents")
  await expect(page.getByRole("row").filter({ hasText: "E2E Handbook" })).toContainText("Sau khi duyệt")
  await menu(page, "E2E Handbook").click()
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  await page.getByRole("dialog").getByLabel("Nhận xét").fill("E2E fine")
  await page.getByRole("dialog").getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approve.length).toBe(1)
  expect(approve[0]).toEqual({ comment: "E2E fine" })
  await page.getByRole("button", { name: "Tải E2E Code" }).click()
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__opened)).toEqual(["https://files.example.com/e2e-code.pdf"])
})

test("HR-050 khiếu nại giao người xử lý (AssignForm); chấp nhận nghỉ việc gửi status + phỏng vấn nghỉ việc", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/employees", { method: "GET", body: pageOf([EMP]) })
  await mockApi(page, "/v1/lifecycle/complaints", { method: "GET", body: pageOf([{ id: "7", subject: "E2E Noise", complainant: { id: "36", fullName: "E2E Bích" }, complaintType: { name: "E2E Workplace" }, complaintDate: "2026-11-21", status: "IN_REVIEW" }]) })
  const assign = await mockApi(page, "/v1/lifecycle/complaints/7/assign", { method: "PUT", body: ok({}) })
  await mockApi(page, "/v1/lifecycle/resignations", { method: "GET", body: pageOf([{ id: "3", employee: { id: "35", fullName: "E2E An" }, resignationDate: "2026-11-20", status: "PENDING" }]) })
  const status = await mockApi(page, "/v1/lifecycle/resignations/3/status", { method: "PUT", body: ok({}) })
  await page.goto("/hrm/issues")
  await menu(page, "E2E Noise").click()
  await expect(page.getByRole("menuitem", { name: "Bắt đầu xem xét" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Giao xử lý" }).click()
  const d = page.getByRole("dialog")
  await d.getByRole("combobox", { name: "Người xử lý" }).click()
  await page.getByRole("option", { name: "E2E An (EMP000001)" }).click()
  await d.getByLabel("Hạn giải quyết").fill("2026-12-05")
  await d.getByRole("button", { name: "Giao xử lý" }).click()
  await expect.poll(() => assign.length).toBe(1)
  expect(assign[0]).toEqual({ assignedToId: 35, resolutionDeadline: "2026-12-05" })

  await page.goto("/hrm/career?tab=resignations")
  await menu(page, "E2E An").click()
  await page.getByRole("menuitem", { name: "Chấp nhận" }).click()
  const r = page.getByRole("dialog")
  await expect(r).toContainText("Chấp nhận sẽ cho nhân viên nghỉ việc ngay.")
  await r.getByRole("switch", { name: "Đã phỏng vấn nghỉ việc" }).click()
  await r.getByLabel("Ngày phỏng vấn").fill("2026-11-25")
  await r.getByLabel("Ý kiến phỏng vấn").fill("E2E feedback")
  await r.getByRole("button", { name: "Chấp nhận" }).click()
  await expect.poll(() => status.length).toBe(1)
  expect(status[0]).toEqual({ status: "ACCEPTED", exitInterviewConducted: true, exitInterviewDate: "2026-11-25", exitFeedback: "E2E feedback" })
})

test("HR-041 tab trạng thái có số đếm từ /status-counts, tìm kiếm gửi keyword cho cả danh sách và số đếm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/lifecycle/resignations", { method: "GET", body: pageOf([]) })
  const counts = await mockApi(page, "/v1/lifecycle/resignations/status-counts", { body: ok({ all: 30, byStatus: { PENDING: 9, ACCEPTED: 17, REJECTED: 4 } }) })
  await page.goto("/hrm/career?tab=resignations")
  await expect(page.getByRole("tab", { name: "Tất cả (30)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Chờ duyệt (9)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Đã chấp nhận (17)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Từ chối (4)" })).toBeVisible()
  const before = counts.requests.length
  await page.getByRole("tab", { name: "Chờ duyệt (9)" }).click()
  await expect(page).toHaveURL(/status=PENDING/)
  expect(counts.requests.length).toBe(before) // a status change does not reload the counts
  await page.getByRole("textbox", { name: "Tìm kiếm" }).fill("E2E")
  await page.getByRole("textbox", { name: "Tìm kiếm" }).press("Enter")
  await expect.poll(() => counts.requests.at(-1)?.url.searchParams.get("keyword")).toBe("E2E")
})

test("HR-042 cảnh cáo: cột Người cảnh cáo và Tài liệu (FileRef mở link http(s), link khác chỉ hiện tên)", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/lifecycle/warnings/status-counts", { body: ok({ all: 2, byStatus: { PENDING: 2 } }) })
  await mockApi(page, "/v1/lifecycle/warnings", {
    method: "GET",
    body: pageOf([
      { id: "1", subject: "E2E Đi muộn", employee: { id: "35", fullName: "E2E An" }, warnedBy: { id: "36", fullName: "E2E Bình" }, warningDate: "2026-11-20", status: "PENDING", document: { id: "9", name: "bien-ban.pdf", viewUrl: "https://files.example.com/bien-ban.pdf" } },
      { id: "2", subject: "E2E Vắng", employee: { id: "35", fullName: "E2E An" }, warningDate: "2026-11-21", status: "PENDING", document: { id: "10", name: "x.pdf", viewUrl: "javascript:alert(1)" } },
    ]),
  })
  await page.goto("/hrm/issues?tab=warnings")
  const r1 = page.getByRole("row").filter({ hasText: "E2E Đi muộn" })
  await expect(r1).toContainText("E2E Bình")
  await expect(r1.getByRole("link", { name: "bien-ban.pdf" })).toHaveAttribute("href", "https://files.example.com/bien-ban.pdf")
  const r2 = page.getByRole("row").filter({ hasText: "E2E Vắng" })
  await expect(r2.getByText("x.pdf")).toBeVisible()
  await expect(r2.getByRole("link")).toHaveCount(0)
})

test("HR-043 danh sách chỉ có documentId: nút Mở tải GET /{id} rồi mở link tài liệu ở tab mới", async ({ page, context }) => {
  await base(page)
  await mockApi(page, "/v1/lifecycle/complaints/status-counts", { body: ok({ all: 1, byStatus: { PENDING: 1 } }) })
  await mockApi(page, "/v1/lifecycle/complaints", { method: "GET", body: pageOf([{ id: "4", subject: "E2E Khiếu nại", complainant: { id: "35", fullName: "E2E An" }, complaintDate: "2026-11-20", status: "PENDING", documentId: "9", document: null }]) })
  const detail = await mockApi(page, "/v1/lifecycle/complaints/4", { body: ok({ id: "4", subject: "E2E Khiếu nại", documentId: "9", document: { id: "9", name: "don.pdf", viewUrl: "http://127.0.0.1:4173/e2e-file.pdf" } }) })
  await context.route("**/e2e-file.pdf", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "E2E FILE" }))
  await page.goto("/hrm/issues")
  const popup = context.waitForEvent("page")
  await page.getByRole("button", { name: "Mở tệp của E2E Khiếu nại" }).click()
  const w = await popup
  await expect(w).toHaveURL(/e2e-file\.pdf/)
  expect(detail.requests.length).toBe(1)
})

test("HR-044 khen thưởng: dòng chỉ có certificateMediaId → nút Mở tải GET /awards/{id} rồi mở giấy chứng nhận", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/org/award-types/options", { body: ok([{ id: "2", name: "E2E Xuất sắc" }]) })
  await mockApi(page, "/v1/lifecycle/awards", { method: "GET", body: pageOf([
    { id: "7", employee: { id: "35", fullName: "E2E An" }, awardType: { id: "2", name: "E2E Xuất sắc" }, awardDate: "2026-11-25", gift: "E2E Quà", certificateMediaId: "9", certificate: null },
    { id: "8", employee: { id: "36", fullName: "E2E Bình" }, awardType: { id: "2", name: "E2E Xuất sắc" }, awardDate: "2026-11-25", gift: "E2E Không file", certificate: null },
  ]) })
  const detail = await mockApi(page, "/v1/lifecycle/awards/7", { body: ok({ id: "7", certificateMediaId: "9", certificate: { id: "9", name: "cn.pdf", viewUrl: "http://127.0.0.1:4173/e2e-cert.pdf" } }) })
  await page.goto("/hrm/recognition")
  await page.evaluate(() => { window.open = (...a) => { /** @type {any} */ (window).__opened = a; return null } })
  await page.getByRole("button", { name: "Mở tệp của E2E An" }).click()
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__opened?.[0])).toBe("http://127.0.0.1:4173/e2e-cert.pdf")
  expect(detail.requests.length).toBe(1)
  await expect(page.getByRole("row").filter({ hasText: "E2E Không file" }).getByRole("button", { name: /Mở tệp/ })).toHaveCount(0)
})
