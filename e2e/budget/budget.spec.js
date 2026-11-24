// @ts-check
/**
 * Financial goals & budget (manual §14). Spec sources: accounting-service GoalController (GoalForm {name, categoryId,
 * type, priority, targetAmount, startDate, targetDate, accountId, description}; ACC_081 target after start; /activate,
 * /complete, /tracking, /milestones MilestoneForm, /contributions ContributionForm), GoalCategoryService (CategoryForm
 * {code ≤30, name, active}), BudgetPeriodController (PeriodForm), BudgetController (BudgetForm; approve → activate →
 * close with BUDGET_APPROVE; /allocations AllocationForm {accountId, allocated, notes}; ACC_094 over budget; /monitoring).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["GOAL_VIEW", "GOAL_MANAGE", "BUDGET_VIEW", "BUDGET_MANAGE", "BUDGET_APPROVE", "COA_VIEW"]
const ACCOUNTS = [
  { id: "209", code: "111", name: "Tiền mặt", accountTypeId: "33", active: true },
  { id: "270", code: "642", name: "Chi phí quản lý doanh nghiệp", accountTypeId: "39", active: true },
]

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/accounting/bank-accounts", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/accounting/chart-of-accounts", { method: "GET", body: pageOf(ACCOUNTS) })
  await mockApi(page, "/v1/accounting/account-types", { method: "GET", body: pageOf([{ id: "39", category: "EXPENSES", code: "COST", name: "Chi phí" }]) })
  await mockApi(page, "/v1/accounting/goal-categories", { method: "GET", body: pageOf([{ id: "3", code: "SAVE", name: "E2E Savings", active: true }]) })
}
/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("BG-001 mục tiêu: ngày đích phải sau ngày bắt đầu, gửi GoalForm; nháp kích hoạt qua xác nhận @smoke", async ({ page }) => {
  await base(page)
  const goal = { id: "8", name: "E2E Emergency fund", categoryId: "3", type: "SAVINGS", priority: "HIGH", targetAmount: 10000000, startDate: "2026-01-01", targetDate: "2026-12-31", status: "DRAFT" }
  await mockApi(page, "/v1/accounting/goals", { method: "GET", body: pageOf([goal]) })
  const create = await mockApi(page, "/v1/accounting/goals", { method: "POST", body: ok(goal) })
  const activate = await mockApi(page, "/v1/accounting/goals/8/activate", { method: "POST", body: ok({ ...goal, status: "ACTIVE" }) })
  await page.goto("/accounting/goals")
  await expect(page.getByRole("row").filter({ hasText: "E2E Emergency fund" })).toContainText("E2E Savings")
  await page.getByRole("button", { name: "Tạo mục tiêu" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên").fill("E2E New goal")
  await dialog.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Savings" }).click()
  await dialog.getByRole("combobox", { name: "Ưu tiên" }).click()
  await page.getByRole("option", { name: "Cao" }).click()
  await dialog.getByLabel("Số tiền mục tiêu").fill("5000000")
  await dialog.getByLabel("Ngày bắt đầu").fill("2026-03-01")
  await dialog.getByLabel("Ngày đạt mục tiêu").fill("2026-02-01")
  await expect(dialog.getByText("Phải sau ngày bắt đầu")).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
  await dialog.getByLabel("Ngày đạt mục tiêu").fill("2026-09-30")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ name: "E2E New goal", categoryId: 3, type: "SAVINGS", priority: "HIGH", targetAmount: 5000000, startDate: "2026-03-01", targetDate: "2026-09-30" })
  await menu(page, "E2E Emergency fund").click()
  await page.getByRole("menuitem", { name: "Kích hoạt" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Kích hoạt" }).click()
  await expect.poll(() => activate.requests.length).toBe(1)
})

test("BG-002 theo dõi mục tiêu: trạng thái, mốc đã đạt, thêm đóng góp gửi ContributionForm", async ({ page }) => {
  await base(page)
  const goal = { id: "8", name: "E2E Emergency fund", type: "SAVINGS", targetAmount: 10000000, startDate: "2026-01-01", targetDate: "2026-12-31", status: "ACTIVE" }
  await mockApi(page, "/v1/accounting/goals", { method: "GET", body: pageOf([goal]) })
  await mockApi(page, "/v1/accounting/goals/8/tracking", {
    body: ok({ targetAmount: 10000000, currentAmount: 6000000, manualAmount: 6000000, automaticAmount: 0, progressPercent: 60, elapsedPercent: 89.3, daysRemaining: 39, trackingStatus: "BEHIND" }),
  })
  await mockApi(page, "/v1/accounting/goals/8/milestones", { method: "GET", body: ok([{ id: "1", name: "E2E Half", targetAmount: 5000000, targetDate: "2026-06-30", status: "ACHIEVED" }]) })
  await mockApi(page, "/v1/accounting/goals/8/contributions", { method: "GET", body: ok([]) })
  const contribute = await mockApi(page, "/v1/accounting/goals/8/contributions", { method: "POST", body: ok({ id: "2" }) })
  await page.goto("/accounting/goals")
  await page.getByRole("button", { name: "E2E Emergency fund", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByTestId("goal-current")).toContainText("6.000.000")
  await expect(dialog.getByTestId("goal-tracking")).toHaveText("Chậm tiến độ")
  await expect(dialog.getByRole("row").filter({ hasText: "E2E Half" })).toContainText("Đã đạt")
  await expect(dialog.getByRole("button", { name: "Thêm đóng góp" })).toBeDisabled()
  await dialog.getByLabel("Ngày đóng góp").fill("2026-11-20")
  await dialog.getByLabel("Số tiền đóng góp").fill("1500000")
  await dialog.getByLabel("Ghi chú đóng góp").fill("E2E top-up")
  await dialog.getByRole("button", { name: "Thêm đóng góp" }).click()
  await expect.poll(() => contribute.length).toBe(1)
  expect(contribute[0]).toEqual({ date: "2026-11-20", amount: 1500000, notes: "E2E top-up" })
})

test("BG-003 danh mục mục tiêu: gửi CategoryForm {code, name, active}", async ({ page }) => {
  await base(page)
  const save = await mockApi(page, "/v1/accounting/goal-categories", { method: "POST", body: ok({ id: "4" }) })
  await page.goto("/accounting/goals?tab=categories")
  await expect(page.getByRole("row").filter({ hasText: "SAVE" })).toContainText("Đang dùng")
  await page.getByRole("button", { name: "Tạo danh mục" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Mã").fill("INV")
  await dialog.getByLabel("Tên").fill("E2E Investment")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ code: "INV", name: "E2E Investment", active: true })
})

test("BG-010 kỳ ngân sách: ngày kết thúc phải sau ngày bắt đầu, gửi PeriodForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/budget-periods", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/accounting/budgets", { method: "GET", body: pageOf([]) })
  const save = await mockApi(page, "/v1/accounting/budget-periods", { method: "POST", body: ok({ id: "5" }) })
  await page.goto("/accounting/budgets?tab=periods")
  await page.getByRole("button", { name: "Tạo kỳ ngân sách" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên").fill("E2E FY2027")
  await dialog.getByLabel("Năm tài chính").fill("2027")
  await dialog.getByLabel("Ngày bắt đầu").fill("2027-12-31")
  await dialog.getByLabel("Ngày kết thúc").fill("2027-01-01")
  await expect(dialog.getByText("Phải sau ngày bắt đầu")).toBeVisible()
  await dialog.getByLabel("Ngày bắt đầu").fill("2027-01-01")
  await dialog.getByLabel("Ngày kết thúc").fill("2027-12-31")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ name: "E2E FY2027", financialYear: 2027, startDate: "2027-01-01", endDate: "2027-12-31" })
})

test("BG-011 ngân sách: Nháp → Duyệt; theo dõi phân bổ, chỉ tài khoản chi phí, vượt ngân sách báo ACC_094", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/budget-periods", { method: "GET", body: pageOf([{ id: "5", name: "E2E FY2026", financialYear: 2026, startDate: "2026-01-01", endDate: "2026-12-31", status: "ACTIVE" }]) })
  const budget = { id: "9", periodId: "5", name: "E2E Office", type: "OPERATIONAL", amount: 3000000, status: "DRAFT" }
  await mockApi(page, "/v1/accounting/budgets", { method: "GET", body: pageOf([budget]) })
  const approve = await mockApi(page, "/v1/accounting/budgets/9/approve", { method: "POST", body: ok({ ...budget, status: "APPROVED" }) })
  await mockApi(page, "/v1/accounting/budgets/9/monitoring", {
    body: ok({
      budgetAmount: 3000000,
      allocated: 2000000,
      spent: 2500000,
      remaining: -500000,
      variancePercent: -25,
      overBudget: true,
      lines: [{ id: "1", accountId: "270", accountCode: "642", accountName: "Chi phí quản lý doanh nghiệp", allocated: 2000000, spent: 2500000, remaining: -500000, variancePercent: -25, overBudget: true }],
    }),
  })
  const allocate = await mockApi(page, "/v1/accounting/budgets/9/allocations", { method: "POST", status: 400, body: fail("ACC_094", "Tổng phân bổ sẽ là 4.000.000, vượt số tiền ngân sách 3.000.000.") })
  await page.goto("/accounting/budgets")
  await expect(page.getByRole("row").filter({ hasText: "E2E Office" })).toContainText("E2E FY2026")
  await page.getByRole("button", { name: "E2E Office", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByTestId("m-spent")).toContainText("2.500.000")
  await expect(dialog.getByRole("row").filter({ hasText: "642" }).getByText("-25.0%")).toHaveClass(/text-destructive/)
  await dialog.getByRole("combobox", { name: "Tài khoản chi phí" }).click()
  await expect(page.getByRole("option")).toHaveCount(1)
  await page.getByRole("option", { name: "642 · Chi phí quản lý doanh nghiệp" }).click()
  await dialog.getByRole("spinbutton", { name: "Đã phân bổ" }).fill("2000000")
  await dialog.getByRole("button", { name: "Phân bổ" }).click()
  await expect.poll(() => allocate.length).toBe(1)
  expect(allocate[0]).toEqual({ accountId: 270, allocated: 2000000 })
  await expect(page.getByText("vượt số tiền ngân sách")).toBeVisible()
  await page.keyboard.press("Escape")
  await menu(page, "E2E Office").click()
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approve.requests.length).toBe(1)
})

test("BG-004 mục tiêu: số lượng trên tab trạng thái từ totalElements, gọi song song mọi trạng thái", async ({ page }) => {
  await base(page)
  const totals = { "": 10, DRAFT: 4, ACTIVE: 5, COMPLETED: 1 }
  /** @type {string[]} */
  const asked = []
  await page.route(/\/api\/v1\/accounting\/goals(\?.*)?$/, (route) => {
    const st = new URL(route.request().url()).searchParams.get("status") ?? ""
    asked.push(st)
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(pageOf([], { total: totals[/** @type {keyof typeof totals} */ (st)] ?? 0 })) })
  })
  await page.goto("/accounting/goals")
  await expect(page.getByRole("tab", { name: "Tất cả (10)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Nháp (4)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Đang áp dụng (5)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Hoàn thành (1)" })).toBeVisible()
  expect(asked).toEqual(expect.arrayContaining(["", "DRAFT", "ACTIVE", "COMPLETED"]))
})

test("BG-012 kỳ ngân sách: tab Đang áp dụng / Đã đóng có số lượng, lọc danh sách, giữ trên URL", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/budget-periods", {
    method: "GET",
    body: pageOf([
      { id: "5", name: "E2E FY2026", financialYear: 2026, startDate: "2026-01-01", endDate: "2026-12-31", status: "ACTIVE" },
      { id: "4", name: "E2E FY2025", financialYear: 2025, startDate: "2025-01-01", endDate: "2025-12-31", status: "CLOSED" },
    ]),
  })
  await mockApi(page, "/v1/accounting/budgets", { method: "GET", body: pageOf([]) })
  await page.goto("/accounting/budgets?tab=periods")
  await expect(page.getByRole("tab", { name: "Tất cả (2)" })).toBeVisible()
  await page.getByRole("tab", { name: "Đã đóng (1)" }).click()
  await expect(page).toHaveURL(/pstatus=CLOSED/)
  await expect(page.getByRole("button", { name: "E2E FY2025" })).toBeVisible()
  await expect(page.getByRole("button", { name: "E2E FY2026" })).toHaveCount(0)
})
