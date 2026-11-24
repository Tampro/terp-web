// @ts-check
/**
 * §5 module dashboards (5.1 Project, 5.2 Account, 5.5 POS, 5.6 CRM, 5.7 Support). Spec: report-service
 * /v1/reports/{project,account,pos,crm,support}-dashboard?year → { parts: { <name>: {data, error} } }; tabs follow the
 * permissions; a tab's dashboard is requested only when the tab is opened.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const months = (f) => Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...f(i) }))
const PROJECT = { parts: { stats: { data: { year: 2026, scope: "ALL", totalProjects: 4, overdueProjects: 1, totalTasks: 8, completedTasks: 6, taskCompletionPercent: 75, activeBugs: 2, teamSize: 3, clients: 2, monthly: months(() => ({ created: 1, completed: 1 })), byStatus: { ONGOING: 3, ON_HOLD: 0, FINISHED: 1 }, byPriority: { LOW: 1, MEDIUM: 2, HIGH: 5 }, teamPerformance: [{ userId: "52", assigned: 4, done: 3, progress: 75 }] }, error: null } } }
const ACCOUNT = { parts: { stats: { data: { year: 2026, totalRevenue: 1500000, totalExpense: 500000, customerPayments: 1000000, vendorPayments: 200000, netCashFlow: 2500000, clients: 3, vendors: 2, monthly: months(() => ({ moneyIn: 0, moneyOut: 0 })), recentRevenues: [{ id: "1", number: "REV-E2E-001", date: "2026-11-22", amount: 1500000, status: "POSTED" }], recentExpenses: [] }, error: null } } }
const POS = { parts: { sales: { data: { todayOrders: 2, todayRevenue: 300000, totalOrders: 10, totalRevenue: 2805000, averageTransaction: 280500, monthly: months(() => ({ orders: 1, total: 0 })), heatmap: [{ dayOfWeek: 1, hour: 9, orders: 3, total: 0 }], topProducts: [{ itemId: "1", itemName: "E2E Keyboard", sku: "E2E-KB", quantity: 2, revenue: 2640000, orders: 1 }] }, error: null }, stock: { data: null, error: "COMMON_004" } } }
const CRM = { parts: { stats: { data: { scope: "OWN", deals: 6, leads: 5, users: 1, clients: 2, calls: 7, upcomingTasks: [{ id: "5", leadId: "6", leadName: "E2E Lan", name: "E2E Call back", taskDate: "2026-11-24", taskTime: "09:30:00", priority: "HIGH" }], dealsByStage: [{ stageId: "1", stageName: "E2E Discovery", count: 3, value: 213000000 }], recentDeals: [{ id: "8", name: "E2E Rollout", price: 75000000 }], recentLeads: [] }, error: null } } }
const SUPPORT = { parts: { stats: { data: { scope: "ALL", total: 3, open: 2, closed: 1, today: 1, averageFirstResponseMinutes: 0.7, byStatus: { IN_PROGRESS: 2, ON_HOLD: 0, CLOSED: 1 }, byCategory: [{ categoryId: "8", name: "E2E Tech", count: 2 }], kbArticles: 1, faqs: 2, monthly: months(() => ({ created: 0, closed: 0 })) }, error: null } } }

/** @param {import('@playwright/test').Page} page @param {string[]} permissions */
async function open(page, permissions) {
  await mockLoggedIn(page, { permissions })
  const calls = {
    project: await mockApi(page, "/v1/reports/project-dashboard", { body: ok(PROJECT) }),
    account: await mockApi(page, "/v1/reports/account-dashboard", { body: ok(ACCOUNT) }),
    pos: await mockApi(page, "/v1/reports/pos-dashboard", { body: ok(POS) }),
    crm: await mockApi(page, "/v1/reports/crm-dashboard", { body: ok(CRM) }),
    support: await mockApi(page, "/v1/reports/support-dashboard", { body: ok(SUPPORT) }),
  }
  await mockApi(page, "/v1/iam/users", { body: ok({ content: [{ id: "52", fullName: "E2E Project Lead" }], page: 0, size: 200, totalElements: 1, totalPages: 1, last: true }) })
  await page.goto("/dashboard")
  return calls
}

test("MDASH-001 tab theo quyền; chỉ tải dashboard của tab đang mở; Dự án hiện tỉ lệ hoàn thành và tên thành viên @smoke", async ({ page }) => {
  const calls = await open(page, ["PROJECT_VIEW", "ACCOUNTING_REPORT_VIEW"])
  await expect(page.getByRole("tab", { name: "Dự án" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Kế toán" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "POS" })).toHaveCount(0)
  await expect(page.getByTestId("mdash-project-completion")).toHaveText("75%")
  await expect(page.getByTestId("mdash-team")).toContainText("E2E Project Lead")
  expect(calls.account.length).toBe(0)
  expect(calls.project.requests[0].url.searchParams.get("year")).toBe(String(new Date().getFullYear()))
  await page.getByRole("tab", { name: "Kế toán" }).click()
  await expect(page.getByTestId("mdash-net-cash")).toContainText("2.500.000")
  await expect(page.getByRole("link", { name: /REV-E2E-001/ })).toBeVisible()
  expect(calls.account.length).toBe(1)
})

test("MDASH-002 POS: doanh thu hôm nay, bản đồ giờ cao điểm, sản phẩm bán chạy; phần tồn kho không có quyền thì báo", async ({ page }) => {
  await open(page, ["POS_REPORT"])
  await expect(page.getByTestId("mdash-pos-today")).toContainText("300.000")
  await expect(page.getByTestId("mdash-heatmap").locator("td[title*='9:00 · 3']")).toHaveCount(1)
  await expect(page.getByTestId("mdash-top-products")).toContainText("E2E Keyboard")
  await expect(page.getByText("Bạn không có quyền xem mục này.").or(page.getByRole("note")).first()).toBeVisible()
})

test("MDASH-003 CRM phạm vi của tôi và việc sắp tới; Hỗ trợ: tổng yêu cầu và thời gian phản hồi", async ({ page }) => {
  await open(page, ["CRM_VIEW_OWN", "SUPPORT_TICKET_VIEW"])
  await expect(page.getByText("Bạn chỉ thấy dữ liệu của chính mình.")).toBeVisible()
  await expect(page.getByTestId("mdash-crm-deals")).toHaveText("6")
  await expect(page.getByTestId("mdash-crm-tasks").getByRole("link", { name: /E2E Call back/ })).toHaveAttribute("href", "/crm/leads/6")
  await page.getByRole("tab", { name: "Hỗ trợ" }).click()
  await expect(page.getByTestId("mdash-support-total")).toHaveText("3")
  await expect(page.getByText("0,7 phút")).toBeVisible()
})

test("MDASH-004 Hỗ trợ: nút Tạo ticket theo quyền và link cổng hỗ trợ từ cài đặt portal", async ({ page }) => {
  await mockApi(page, "/v1/support/portal/settings", { body: ok({ slug: "e2e-help", enabled: true }) })
  await open(page, ["SUPPORT_TICKET_VIEW", "SUPPORT_TICKET_MANAGE"])
  await page.getByRole("tab", { name: "Hỗ trợ" }).click()
  const qa = page.getByTestId("support-quick-actions")
  await expect(qa.getByRole("link", { name: "Tạo ticket" })).toHaveAttribute("href", "/support/tickets")
  await expect(qa.getByRole("link", { name: "Cổng hỗ trợ" })).toHaveAttribute("href", "/help/e2e-help")
})

test("MDASH-005 Hỗ trợ: chỉ quyền xem và không đọc được cài đặt portal → không có nút thao tác", async ({ page }) => {
  await mockApi(page, "/v1/support/portal/settings", { status: 403, body: { result: false, code: "COMMON_004", message: "Forbidden" } })
  await open(page, ["SUPPORT_TICKET_VIEW"])
  await page.getByRole("tab", { name: "Hỗ trợ" }).click()
  await expect(page.getByTestId("mdash-support-total")).toHaveText("3")
  await expect(page.getByTestId("support-quick-actions")).toHaveCount(0)
})
