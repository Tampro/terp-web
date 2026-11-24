// @ts-check
/**
 * Projects (manual §11.1). Spec sources: project-service ProjectController (ProjectForm, /status, /clients, /duplicate
 * DuplicateForm, /report, /milestones MilestoneForm), TaskController (TaskForm, /tasks/board, /move MoveForm, subtasks,
 * comments), BugController (BugForm, /bugs/board), StageController (/stages/order StageOrderForm, PRJ_013);
 * PRJ_007 (end before start); PROJECT_VIEW / PROJECT_MANAGE / PROJECT_TASK_MANAGE.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["PROJECT_VIEW", "PROJECT_MANAGE", "PROJECT_TASK_MANAGE"]
const USERS = [
  { id: "9001", username: "e2e.admin", fullName: "E2E Admin" },
  { id: "9002", username: "e2e.dev", fullName: "E2E Dev" },
]
const PROJECT = {
  id: "6",
  name: "E2E Website",
  startDate: "2026-11-01",
  endDate: "2026-12-31",
  budget: 150000000,
  description: "E2E project",
  status: "ONGOING",
  overdue: false,
  userIds: ["9001"],
  clientIds: [],
}
const STAGES = [
  { id: "1", kind: "TASK", name: "Todo", position: 1, done: false },
  { id: "2", kind: "TASK", name: "In Progress", position: 2, done: false },
  { id: "4", kind: "TASK", name: "Done", position: 3, done: true },
]
const TASK = { id: "10", projectId: "6", title: "E2E Homepage", priority: "HIGH", stageId: "1", stageName: "Todo", assigneeIds: ["9001"], dueDate: "2026-11-27", done: false }

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function base(page, permissions = ALL) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/iam/users", { body: pageOf(USERS) })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf([{ id: "501", companyName: "E2E O'Brien & Sons" }]) })
}

/** @param {import('@playwright/test').Page} page */
async function detail(page) {
  await base(page)
  await mockApi(page, "/v1/projects/6", { method: "GET", body: ok({ project: PROJECT, daysLeft: 39, progress: 25, taskCount: 4, doneTaskCount: 1 }) })
  await mockApi(page, "/v1/projects/6/tasks/board", {
    body: ok([
      { stage: STAGES[0], tasks: [TASK] },
      { stage: STAGES[1], tasks: [] },
      { stage: STAGES[2], tasks: [] },
    ]),
  })
  await mockApi(page, "/v1/projects/6/bugs/board", { body: ok([{ stage: { id: "20", kind: "BUG", name: "Unconfirmed" }, bugs: [] }]) })
  await mockApi(page, "/v1/projects/6/milestones", { method: "GET", body: ok([{ id: "31", title: "E2E Build", status: "ONGOING", progress: 35, cost: 80000000 }]) })
  await mockApi(page, "/v1/projects/6/attachments", { method: "GET", body: ok([]) })
  await mockApi(page, "/v1/projects/6/activity", { body: pageOf([]) })
  await mockApi(page, "/v1/projects/6/report", {
    body: ok({ status: "ONGOING", budget: 150000000, milestoneCost: 110000000, progress: 25, tasksByStage: [], tasksByPriority: { HIGH: 2 }, users: [{ userId: "9001", assigned: 4, done: 1, progress: 25 }], milestonesByStatus: { COMPLETE: 1 } }),
  })
  await mockApi(page, "/v1/projects/stages", { body: ok(STAGES) })
}

test("PRJ-001 danh sách: tab trạng thái gửi status, thẻ có ngân sách, đội; tạo dự án chặn ngày kết thúc trước ngày bắt đầu @smoke", async ({ page }) => {
  await base(page)
  const list = await mockApi(page, "/v1/projects", { method: "GET", body: pageOf([PROJECT]) })
  const create = await mockApi(page, "/v1/projects", { method: "POST", body: ok(PROJECT) })
  await page.goto("/projects")
  await expect(page.getByRole("link", { name: "E2E Website" })).toBeVisible()
  await expect(page.getByText("150.000.000")).toBeVisible()
  await page.getByRole("tab", { name: "Tạm dừng" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("status")).toBe("ON_HOLD")

  await page.getByRole("button", { name: "Tạo dự án" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên dự án").fill("E2E New")
  await dialog.getByLabel("Ngày bắt đầu").fill("2026-12-10")
  await dialog.getByLabel("Ngày kết thúc").fill("2026-12-01")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu")).toBeVisible()
  expect(create).toHaveLength(0)
  await dialog.getByLabel("Ngày kết thúc").fill("2027-01-31")
  await dialog.getByLabel("Ngân sách").fill("5000000")
  await dialog.getByRole("checkbox").nth(1).click() // E2E Dev
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ name: "E2E New", startDate: "2026-12-10", endDate: "2027-01-31", budget: 5000000, description: null, userIds: [9002] })
})

test("PRJ-002 nhân bản: gửi DuplicateForm với các tùy chọn", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/projects", { method: "GET", body: pageOf([PROJECT]) })
  const dup = await mockApi(page, "/v1/projects/6/duplicate", { method: "POST", body: ok(PROJECT) })
  await page.goto("/projects")
  await page.getByRole("button", { name: "Thao tác cho E2E Website" }).click()
  await page.getByRole("menuitem", { name: "Nhân bản" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("Tên dự án")).toHaveValue("E2E Website (copy)")
  await dialog.getByRole("checkbox", { name: "Lỗi" }).click()
  await dialog.getByRole("button", { name: "Nhân bản" }).click()
  await expect.poll(() => dup.length).toBe(1)
  expect(dup[0]).toEqual({ name: "E2E Website (copy)", tasks: true, bugs: false, milestones: true, team: true, clients: true, files: false, activity: false })
})

test("PRJ-010 chi tiết: tổng quan, Kanban task, kéo thẻ gửi MoveForm, tạo task gửi TaskForm chỉ với thành viên đội", async ({ page }) => {
  await detail(page)
  const move = await mockApi(page, "/v1/projects/tasks/10/move", { method: "PUT", body: ok(TASK) })
  const create = await mockApi(page, "/v1/projects/6/tasks", { method: "POST", body: ok(TASK) })
  await page.goto("/projects/6")
  await expect(page.getByText("25%")).toBeVisible()
  await expect(page.getByText("1/4")).toBeVisible()
  await page.getByRole("tab", { name: "Công việc" }).click()
  await expect(page).toHaveURL(/tab=tasks/)
  const progress = page.getByRole("region", { name: "In Progress" })
  await page.locator("[data-card-id='10']").dragTo(progress.getByRole("heading", { name: "In Progress" }))
  await expect.poll(() => move.length).toBe(1)
  expect(move[0]).toEqual({ stageId: 2 })

  await page.getByRole("button", { name: "Thêm công việc" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("checkbox", { name: "E2E Dev" })).toHaveCount(0) // not in the team (PRJ_017)
  await dialog.getByLabel("Tiêu đề").fill("E2E Footer")
  await dialog.getByRole("combobox", { name: "Mốc" }).click()
  await page.getByRole("option", { name: "E2E Build" }).click()
  await dialog.getByRole("checkbox", { name: "E2E Admin" }).click()
  await dialog.getByLabel("Hạn").fill("2026-12-05")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ title: "E2E Footer", milestoneId: 31, priority: "MEDIUM", stageId: null, assigneeIds: [9001], startDate: null, dueDate: "2026-12-05", description: null })
})

test("PRJ-011 việc con và bình luận trong dialog task", async ({ page }) => {
  await detail(page)
  await mockApi(page, "/v1/projects/tasks/10", { method: "GET", body: ok({ task: TASK, subtasks: [{ id: "1", name: "E2E Hero", done: false }], comments: [{ id: "1", authorUserId: "9001", body: "E2E note" }] }) })
  const sub = await mockApi(page, "/v1/projects/subtasks/1", { method: "PUT", body: ok({}) })
  const comment = await mockApi(page, "/v1/projects/tasks/10/comments", { method: "POST", body: ok({}) })
  await page.goto("/projects/6?tab=tasks")
  await page.locator("[data-card-id='10']").getByRole("button").click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("E2E note")).toBeVisible()
  await dialog.getByRole("checkbox", { name: "E2E Hero" }).click()
  await expect.poll(() => sub[0]).toEqual({ name: "E2E Hero", done: true })
  await dialog.getByLabel("Bình luận").fill("E2E reply")
  await dialog.getByRole("button", { name: "Thêm bình luận" }).click()
  await expect.poll(() => comment[0]).toEqual({ body: "E2E reply" })
})

test("PRJ-012 mốc: tiến độ 0..100, gửi MilestoneForm; báo cáo theo người", async ({ page }) => {
  await detail(page)
  const add = await mockApi(page, "/v1/projects/6/milestones", { method: "POST", body: ok({}) })
  await page.goto("/projects/6?tab=milestones")
  await page.getByRole("button", { name: "Thêm mốc" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tiêu đề").fill("E2E Launch")
  await dialog.getByLabel("Tiến độ").fill("150")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Nhập số nguyên từ 0 đến 100")).toBeVisible()
  await dialog.getByLabel("Tiến độ").fill("10")
  await dialog.getByLabel("Chi phí").fill("20000000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => add.length).toBe(1)
  expect(add[0]).toEqual({ title: "E2E Launch", cost: 20000000, startDate: null, endDate: null, summary: null, status: "INCOMPLETE", progress: 10 })
  await page.getByRole("tab", { name: "Báo cáo" }).click()
  await expect(page.getByText("Xong 1/4 việc")).toBeVisible()
})

test("PRJ-020 giai đoạn: đổi thứ tự gửi đủ danh sách (PRJ_013), giai đoạn cuối là Hoàn thành", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/projects/stages", { method: "GET", body: ok(STAGES) })
  const order = await mockApi(page, "/v1/projects/stages/order", { method: "PUT", body: ok(STAGES) })
  await page.goto("/projects/stages")
  await expect(page.getByRole("listitem").filter({ hasText: "Done" })).toContainText("Giai đoạn hoàn thành")
  await page.getByRole("button", { name: "Chuyển In Progress lên" }).click()
  await expect.poll(() => order[0]).toEqual({ kind: "TASK", stageIds: [2, 1, 4] })
})

test("PRJ-003 thẻ thống kê từ /projects/stats: tổng, theo trạng thái, quá hạn", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/projects", { method: "GET", body: pageOf([PROJECT]) })
  await mockApi(page, "/v1/projects/stats", {
    body: ok({ totalProjects: 9, overdueProjects: 2, byStatus: { ONGOING: 5, ON_HOLD: 3, FINISHED: 1 } }),
  })
  await page.goto("/projects")
  const cards = page.getByTestId("project-stats")
  await expect(cards).toContainText("Tổng dự án9")
  await expect(cards).toContainText("Đang thực hiện5")
  await expect(cards).toContainText("Tạm dừng3")
  await expect(cards).toContainText("Hoàn thành1")
  await expect(cards).toContainText("Quá hạn2")
})
