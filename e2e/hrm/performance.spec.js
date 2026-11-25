// @ts-check
/**
 * Performance & training (manual §16). Spec sources: employee-service ReviewController (ScheduleForm {employeeId,
 * reviewerId, reviewCycleId, reviewDate}; ConductForm {ratings[{indicatorId, rating 1..5, comments}], overallComments, pros,
 * cons, submit}; EMP_076 self review, EMP_079 rate every indicator), GoalController (/progress ProgressForm),
 * TrainingSessionController (SessionForm {programId, name, startAt, endAt, locationType, ...}), TrainingTypeController
 * (TypeForm + PUT /{id}/departments DepartmentsForm).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["PERFORMANCE_VIEW", "PERFORMANCE_MANAGE", "TRAINING_VIEW", "TRAINING_MANAGE", "EMPLOYEE_VIEW", "ORG_VIEW"]
const EMPS = [
  { id: "35", employeeNo: "EMP000001", fullName: "E2E An" },
  { id: "36", employeeNo: "EMP000002", fullName: "E2E Bích" },
]

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/employees", { method: "GET", body: pageOf(EMPS) })
  await mockApi(page, "/v1/performance/review-cycles/options", { body: ok([{ id: "1", name: "E2E Q4" }]) })
  await mockApi(page, "/v1/performance/goal-types/options", { body: ok([{ id: "2", name: "E2E Skills" }]) })
  await mockApi(page, "/v1/performance/indicator-categories/options", { body: ok([{ id: "3", name: "E2E Expertise" }]) })
  await mockApi(page, "/v1/org/branches/options", { body: ok([]) })
  await mockApi(page, "/v1/org/departments/options", { body: ok([{ id: "22", name: "E2E Accounting" }]) })
}
/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("PF-001 lên lịch đánh giá: không tự đánh giá, gửi ScheduleForm @smoke", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/performance/reviews", { method: "GET", body: pageOf([]) })
  const save = await mockApi(page, "/v1/performance/reviews", { method: "POST", body: ok({ id: "1" }) })
  await page.goto("/hrm/performance")
  await page.getByRole("button", { name: "Lên lịch đánh giá" }).click()
  const d = page.getByRole("dialog")
  for (const [label, option] of [["Nhân viên", "E2E An (EMP000001)"], ["Người đánh giá", "E2E An (EMP000001)"], ["Chu kỳ", "E2E Q4"]]) {
    await d.getByRole("combobox", { name: label }).click()
    await page.getByRole("option", { name: option }).click()
  }
  await d.getByLabel("Ngày *").fill("2026-11-28")
  await expect(d.getByText("Nhân viên không thể tự đánh giá")).toBeVisible()
  await expect(d.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
  await d.getByRole("combobox", { name: "Người đánh giá" }).click()
  await page.getByRole("option", { name: "E2E Bích (EMP000002)" }).click()
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ employeeId: 35, reviewerId: 36, reviewCycleId: 1, reviewDate: "2026-11-28" })
})

test("PF-002 chấm đánh giá: sao theo chỉ số, điểm trung bình, Hoàn tất chỉ khi chấm hết; gửi ConductForm", async ({ page }) => {
  await base(page)
  const review = {
    id: "5",
    employee: { id: "35", fullName: "E2E An" },
    reviewer: { id: "36", fullName: "E2E Bích" },
    reviewCycle: { id: "1", name: "E2E Q4" },
    reviewDate: "2026-11-28",
    status: "IN_PROGRESS",
    groups: [{ category: "E2E Expertise", indicators: [{ indicatorId: "10", indicatorName: "E2E Quality", rating: 3 }, { indicatorId: "11", indicatorName: "E2E On time" }] }],
  }
  await mockApi(page, "/v1/performance/reviews", { method: "GET", body: pageOf([review]) })
  await mockApi(page, "/v1/performance/reviews/5", { method: "GET", body: ok(review) })
  const conduct = await mockApi(page, "/v1/performance/reviews/5/conduct", { method: "PUT", body: ok(review) })
  await page.goto("/hrm/performance")
  await page.getByRole("button", { name: "E2E An", exact: true }).click()
  const d = page.getByRole("dialog")
  await expect(d.getByRole("radiogroup", { name: "Điểm của E2E Quality" }).getByRole("radio", { name: "3 sao" })).toHaveAttribute("aria-checked", "true")
  await expect(d.getByRole("button", { name: "Hoàn tất đánh giá" })).toBeDisabled()
  await d.getByRole("radiogroup", { name: "Điểm của E2E On time" }).getByRole("radio", { name: "4 sao" }).click()
  await expect(d.getByTestId("review-average")).toHaveText("Điểm tổng: 3.5 / 5")
  await d.getByLabel("Nhận xét về E2E On time").fill("E2E punctual")
  await d.getByLabel("Điểm mạnh").fill("E2E proactive")
  await d.getByRole("button", { name: "Hoàn tất đánh giá" }).click()
  await expect.poll(() => conduct.length).toBe(1)
  expect(conduct[0]).toEqual({ ratings: [{ indicatorId: 10, rating: 3 }, { indicatorId: 11, rating: 4, comments: "E2E punctual" }], pros: "E2E proactive", submit: true })
})

test("PF-003 mục tiêu: cập nhật tiến độ gửi ProgressForm (số nguyên 0..100)", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/performance/goals", { method: "GET", body: pageOf([{ id: "4", title: "E2E Certificate", employee: { fullName: "E2E An" }, goalType: { name: "E2E Skills" }, progress: 0, status: "NOT_STARTED" }]) })
  const progress = await mockApi(page, "/v1/performance/goals/4/progress", { method: "PUT", body: ok({}) })
  await page.goto("/hrm/performance?tab=goals")
  await menu(page, "E2E Certificate").click()
  await page.getByRole("menuitem", { name: "Cập nhật tiến độ" }).click()
  const d = page.getByRole("dialog")
  await d.getByLabel("Tiến độ (%) *").fill("120")
  await expect(d.getByText("Tối đa 100")).toBeVisible()
  await d.getByLabel("Tiến độ (%) *").fill("40")
  await d.getByRole("button", { name: "Cập nhật tiến độ" }).click()
  await expect.poll(() => progress.length).toBe(1)
  expect(progress[0]).toEqual({ progress: 40 })
})

test("TR-001 buổi đào tạo: kết thúc sau bắt đầu, link chỉ khi trực tuyến; gửi SessionForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/training/programs/options", { body: ok([{ id: "6", name: "E2E VAS" }]) })
  await mockApi(page, "/v1/training/trainers/options", { body: ok([{ id: "2", name: "E2E Tuấn" }]) })
  await mockApi(page, "/v1/training/types/options", { body: ok([]) })
  await mockApi(page, "/v1/training/sessions", { method: "GET", body: pageOf([]) })
  const save = await mockApi(page, "/v1/training/sessions", { method: "POST", body: ok({ id: "1" }) })
  await page.goto("/hrm/training")
  await page.getByRole("button", { name: "Lên lịch buổi đào tạo" }).click()
  const d = page.getByRole("dialog")
  await d.getByLabel("Tên *").fill("E2E Session 1")
  await d.getByRole("combobox", { name: "Chương trình" }).click()
  await page.getByRole("option", { name: "E2E VAS" }).click()
  await d.getByRole("combobox", { name: "Giảng viên" }).click()
  await page.getByRole("option", { name: "E2E Tuấn" }).click()
  await d.getByLabel("Bắt đầu *").fill("2026-11-28T09:00")
  await d.getByLabel("Kết thúc *").fill("2026-11-28T08:00")
  await expect(d.getByText("Phải sau thời điểm bắt đầu")).toBeVisible()
  await d.getByLabel("Kết thúc *").fill("2026-11-28T12:00")
  await expect(d.getByLabel("Link họp")).toHaveCount(0)
  await d.getByRole("combobox", { name: "Hình thức" }).click()
  await page.getByRole("option", { name: "Trực tuyến" }).click()
  await expect(d.getByLabel("Địa điểm")).toHaveCount(0)
  await d.getByLabel("Link họp").fill("https://meet.example.com/e2e")
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ name: "E2E Session 1", programId: 6, trainerId: 2, startAt: "2026-11-28T09:00", endAt: "2026-11-28T12:00", locationType: "VIRTUAL", status: "SCHEDULED", meetingLink: "https://meet.example.com/e2e" })
})

test("TR-002 loại đào tạo: phòng ban gửi riêng qua PUT /{id}/departments", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/training/types", { method: "GET", body: pageOf([]) })
  const create = await mockApi(page, "/v1/training/types", { method: "POST", body: ok({ id: "9" }) })
  const departments = await mockApi(page, "/v1/training/types/9/departments", { method: "PUT", body: ok({ id: "9" }) })
  await page.goto("/hrm/training?tab=types")
  await page.getByRole("button", { name: "Thêm loại" }).click()
  const d = page.getByRole("dialog")
  await d.getByLabel("Tên *").fill("E2E Accounting skills")
  await d.getByRole("checkbox", { name: "E2E Accounting" }).check()
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => departments.length).toBe(1)
  expect(create[0]).toEqual({ name: "E2E Accounting skills" })
  expect(departments[0]).toEqual({ departmentIds: [22] })
})

test("PF-004 tab trạng thái mục tiêu và chương trình đào tạo có số đếm từ /status-counts", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/performance/goals", { method: "GET", body: pageOf([]) })
  const counts = await mockApi(page, "/v1/performance/goals/status-counts", { body: ok({ all: 7, byStatus: { NOT_STARTED: 2, IN_PROGRESS: 3, COMPLETED: 1, OVERDUE: 1 } }) })
  await page.goto("/hrm/performance?tab=goals")
  await expect(page.getByRole("tab", { name: "Tất cả (7)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Đang thực hiện (3)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Hoàn tất (1)" })).toBeVisible()
  await page.getByRole("textbox", { name: "Tìm kiếm" }).fill("E2E")
  await page.getByRole("textbox", { name: "Tìm kiếm" }).press("Enter")
  await expect.poll(() => counts.requests.at(-1)?.url.searchParams.get("keyword")).toBe("E2E")

  await mockApi(page, "/v1/training/programs", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/training/programs/status-counts", { body: ok({ all: 5, byStatus: { ACTIVE: 4 } }) })
  await page.goto("/hrm/training?tab=programs")
  await expect(page.getByRole("tab", { name: "Tất cả (5)" })).toBeVisible()
})

test("PF-005 hủy đánh giá: PENDING / IN_PROGRESS gửi status CANCELLED sau xác nhận; tab Đã hủy", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/performance/reviews", { method: "GET", body: pageOf([{ id: "9", status: "PENDING", employee: { id: "35", fullName: "E2E An" } }]) })
  const put = await mockApi(page, "/v1/performance/reviews/9/status", { method: "PUT", body: ok({ id: "9", status: "CANCELLED" }) })
  await page.goto("/hrm/performance")
  await expect(page.getByRole("tab", { name: /^Đã hủy/ })).toBeVisible()
  await menu(page, "E2E An").click()
  await page.getByRole("menuitem", { name: "Hủy đánh giá" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Hủy đánh giá" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ status: "CANCELLED" })
})

test("TR-003 đánh giá đào tạo: tab loại có số đếm {all, byType}, chi tiết thống kê, thêm kết quả gửi ResultForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/training/programs/options", { body: ok([{ id: "3", name: "E2E VAS" }]) })
  const counts = await mockApi(page, "/v1/training/assessments/type-counts", { body: ok({ all: 3, byType: { QUIZ: 2, PRACTICAL: 1, PRESENTATION: 0 } }) })
  const list = await mockApi(page, "/v1/training/assessments", { method: "GET", body: pageOf([{ id: "1", name: "E2E Quiz cuối", program: { id: "3", name: "E2E VAS" }, type: "QUIZ", passingScore: 70, results: 1 }]) })
  await mockApi(page, "/v1/training/assessments/1", {
    method: "GET",
    body: ok({ id: "1", name: "E2E Quiz cuối", program: { id: "3", name: "E2E VAS" }, type: "QUIZ", passingScore: 70, statistics: { totalResults: 1, passRate: 100, averageScore: 82.5, passed: 1, failed: 0 }, resultList: [{ id: "5", employeeTrainingId: "8", employee: { fullName: "E2E Bích" }, score: 82.5, passed: true, assessedDate: "2026-11-25" }] }),
  })
  await mockApi(page, "/v1/training/employee-trainings", { method: "GET", body: pageOf([{ id: "9", employee: { id: "35", fullName: "E2E An" }, program: { id: "3" } }, { id: "8", employee: { id: "36", fullName: "E2E Bích" }, program: { id: "3" } }]) })
  const add = await mockApi(page, "/v1/training/assessments/1/results", { method: "POST", body: ok({ id: "6" }) })
  await page.goto("/hrm/training?tab=assessments&programId=3")
  await page.getByRole("button", { name: "Thao tác cho E2E Quiz cuối" }).click()
  await expect(page.getByRole("menuitem", { name: "Xóa" })).toHaveCount(0) // has results
  await page.keyboard.press("Escape")
  await expect(page.getByRole("tab", { name: "Tất cả (3)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Trắc nghiệm (2)" })).toBeVisible()
  expect(counts.requests.at(-1)?.url.searchParams.get("programId")).toBe("3")
  await page.getByRole("tab", { name: "Thực hành (1)" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("type")).toBe("PRACTICAL")
  await page.getByText("E2E Quiz cuối").click()
  const view = page.getByRole("dialog")
  await expect(view.getByTestId("assessment-stats")).toContainText("100%")
  await expect(view.getByRole("row").filter({ hasText: "E2E Bích" })).toContainText("Đạt")
  await view.getByRole("combobox", { name: "Học viên" }).click()
  await expect(page.getByRole("option", { name: "E2E Bích" })).toHaveCount(0) // already has a result (EMP_091)
  await page.getByRole("option", { name: "E2E An" }).click()
  await view.getByLabel("Điểm (%)").fill("120")
  await expect(view.getByText("Nhập từ 0 đến 100")).toBeVisible()
  await expect(view.getByRole("button", { name: "Thêm kết quả" })).toBeDisabled()
  await view.getByLabel("Điểm (%)").fill("64")
  await view.getByRole("button", { name: "Thêm kết quả" }).click()
  await expect.poll(() => add.requests.length).toBe(1)
  expect(add.requests[0].body).toMatchObject({ employeeTrainingId: 9, score: 64 })
})

test("TR-004 giảng viên: lọc chi nhánh / phòng ban gửi branchId / departmentId, đổi chi nhánh bỏ phòng ban", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/org/branches/options", { body: ok([{ id: "24", name: "E2E HCM" }, { id: "32", name: "E2E HN" }]) })
  await mockApi(page, "/v1/org/departments/options", { body: ok([{ id: "22", name: "E2E Accounting", branchId: "24" }, { id: "23", name: "E2E Sales", branchId: "32" }]) })
  const list = await mockApi(page, "/v1/training/trainers", { method: "GET", body: pageOf([]) })
  await page.goto("/hrm/training?tab=trainers&branchId=24&departmentId=22")
  await expect.poll(() => [list.requests.at(-1)?.url.searchParams.get("branchId"), list.requests.at(-1)?.url.searchParams.get("departmentId")]).toEqual(["24", "22"])
  await page.getByRole("combobox", { name: "Chi nhánh" }).click()
  await page.getByRole("option", { name: "E2E HN" }).click()
  await expect(page).toHaveURL(/branchId=32/)
  await expect(page).not.toHaveURL(/departmentId/)
  await page.getByRole("combobox", { name: "Phòng ban" }).click()
  await expect(page.getByRole("option", { name: "E2E Sales" })).toBeVisible()
  await expect(page.getByRole("option", { name: "E2E Accounting" })).toHaveCount(0)
})
