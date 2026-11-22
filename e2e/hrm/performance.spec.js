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
