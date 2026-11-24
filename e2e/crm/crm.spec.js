// @ts-check
/**
 * CRM setup, leads, deals, reports (manual §7.1–7.4).
 * Spec sources: crm-service SetupController (/crm/pipelines, /stages, /labels, /sources, stages/order StageOrderForm),
 * CrmControllers (/crm/leads(+/board, /{id}/stage MoveForm, /{id}/convert ConvertForm, /{id}/{members|labels|…}
 * LinksForm), /crm/deals(+/board, /status), /crm/{leads|deals}/{id}/tasks|calls|discussions|emails|files),
 * ReportService (byUser carries the user id only); CRM_011 (converted once), CRM_018 (client); CRM_VIEW / CRM_MANAGE.
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import {
  CRM_ALL,
  CUSTOMERS,
  DEAL_BOARD,
  DEALS,
  ITEMS,
  LABELS,
  LEAD_BOARD,
  LEAD_DETAIL,
  LEADS,
  PIPELINES,
  SOURCES,
  USERS,
} from "./data.js"

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function crm(page, permissions = CRM_ALL) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/crm/pipelines", { method: "GET", body: ok(PIPELINES) })
  await mockApi(page, "/v1/crm/labels", { method: "GET", body: ok(LABELS) })
  await mockApi(page, "/v1/crm/sources", { method: "GET", body: ok(SOURCES) })
  await mockApi(page, "/v1/iam/users", { body: pageOf(USERS) })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf(CUSTOMERS) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
}

/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("CRM-001 danh sách lead: ngày theo dõi quá hạn màu đỏ, Đã chuyển đổi, lọc giai đoạn gửi stageId @smoke", async ({ page }) => {
  await crm(page)
  const list = await mockApi(page, "/v1/crm/leads", { method: "GET", body: pageOf(LEADS) })
  await page.goto("/crm/leads")
  const lan = page.getByRole("row").filter({ hasText: "E2E Lan" })
  await expect(lan).toContainText("E2E Admin") // owner id resolved from /iam/users
  await expect(lan).toContainText("1/2")
  await expect(lan.getByText("01/11/2026")).toHaveClass(/text-destructive/)
  await expect(page.getByRole("row").filter({ hasText: "E2E Minh" })).toContainText("Đã chuyển đổi")
  expect(list.requests[0].url.searchParams.get("pipelineId")).toBe("1")

  await page.getByRole("combobox", { name: "Giai đoạn" }).click()
  await page.getByRole("option", { name: "Qualified" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("stageId")).toBe("12")
  await expect(page).toHaveURL(/stageId=12/)
})

test("CRM-002 không có pipeline: chỉ tới Thiết lập CRM, không gọi danh sách", async ({ page }) => {
  await crm(page)
  await mockApi(page, "/v1/crm/pipelines", { method: "GET", body: ok([]) })
  const list = await mockApi(page, "/v1/crm/leads", { method: "GET", body: pageOf([]) })
  await page.goto("/crm/leads")
  await expect(page.getByRole("link", { name: "Thiết lập CRM" }).last()).toBeVisible()
  await expect(page.getByRole("button", { name: "Tạo lead" })).toHaveCount(0)
  expect(list).toHaveLength(0)
})

test("CRM-003 tạo lead: bắt buộc tên/email/chủ đề, gửi LeadForm với pipeline và người phụ trách", async ({ page }) => {
  await crm(page)
  await mockApi(page, "/v1/crm/leads", { method: "GET", body: pageOf(LEADS) })
  const create = await mockApi(page, "/v1/crm/leads", { method: "POST", body: ok(LEAD_DETAIL) })
  await page.goto("/crm/leads")
  await page.getByRole("button", { name: "Tạo lead" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Email").fill("not-an-email")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Nhập email hợp lệ")).toBeVisible()
  await expect(dialog.getByText("Bắt buộc").first()).toBeVisible()
  expect(create).toHaveLength(0)

  await dialog.getByLabel("Tên").fill("E2E New lead")
  await dialog.getByLabel("Email").fill("new@example.com")
  await dialog.getByLabel("Chủ đề").fill("E2E subject")
  await dialog.getByLabel("Ngày theo dõi").fill("2026-12-01")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    pipelineId: 1,
    name: "E2E New lead",
    email: "new@example.com",
    subject: "E2E subject",
    ownerUserId: 9001, // defaults to the signed-in user
    phone: null,
    followUpDate: "2026-12-01",
    notes: null,
  })
})

test("CRM-004 Kanban lead: kéo thẻ sang cột khác gửi MoveForm; không có CRM_MANAGE thì không kéo được", async ({ page }) => {
  await crm(page)
  await mockApi(page, "/v1/crm/leads/board", { body: ok(LEAD_BOARD) })
  const move = await mockApi(page, "/v1/crm/leads/101/stage", { method: "PUT", body: ok(LEAD_DETAIL) })
  await page.goto("/crm/leads?mode=board")
  const qualified = page.getByRole("region", { name: "Qualified" })
  await expect(qualified).toContainText("E2E Minh")
  await page.locator("[data-card-id='101']").dragTo(qualified.getByRole("heading", { name: "Qualified" }))
  await expect.poll(() => move.length).toBe(1)
  expect(move[0]).toEqual({ stageId: 12 })
})

test("CRM-005 Kanban chỉ xem khi thiếu CRM_MANAGE", async ({ page }) => {
  await crm(page, ["CRM_VIEW"])
  await mockApi(page, "/v1/crm/leads/board", { body: ok(LEAD_BOARD) })
  await page.goto("/crm/leads?mode=board")
  await expect(page.locator("[data-card-id='101']")).toHaveAttribute("draggable", "false")
  await expect(page.getByRole("button", { name: "Tạo lead" })).toHaveCount(0)
  await menu(page, "E2E Lan").click()
  await expect(page.getByRole("menuitem", { name: "Chuyển thành deal" })).toHaveCount(0)
})

test("CRM-006 chuyển lead thành deal: khách hàng có sẵn bắt buộc (CRM_018), gửi ConvertForm rồi mở deal", async ({ page }) => {
  await crm(page)
  await mockApi(page, "/v1/crm/leads", { method: "GET", body: pageOf(LEADS) })
  const convert = await mockApi(page, "/v1/crm/leads/101/convert", { method: "POST", body: ok({ dealId: "201", customerId: "501" }) })
  await mockApi(page, "/v1/crm/deals/201", { method: "GET", body: ok({ deal: DEALS[0], activity: {} }) })
  await page.goto("/crm/leads")
  await menu(page, "E2E Minh").click()
  await expect(page.getByRole("menuitem", { name: "Đã chuyển đổi" })).toBeDisabled()
  await page.keyboard.press("Escape")

  await menu(page, "E2E Lan").click()
  await page.getByRole("menuitem", { name: "Chuyển thành deal" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("Tên deal")).toHaveValue("E2E rollout")
  await dialog.getByRole("radio", { name: "Khách hàng có sẵn" }).click()
  await dialog.getByRole("button", { name: "Chuyển thành deal" }).click()
  await expect(dialog.getByText("Chọn khách hàng")).toBeVisible()
  expect(convert).toHaveLength(0)

  await dialog.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E O'Brien & Sons" }).click()
  await dialog.getByLabel("Giá trị").fill("75000000")
  await dialog.getByRole("checkbox").first().click() // untick Products
  await dialog.getByRole("button", { name: "Chuyển thành deal" }).click()
  await expect(page).toHaveURL(/\/crm\/deals\/201$/)
  expect(convert[0]).toEqual({
    dealName: "E2E rollout",
    price: 75000000,
    customerId: 501,
    copy: ["SOURCES", "FILES", "DISCUSSIONS", "NOTES", "CALLS", "EMAILS", "TASKS", "USERS"],
  })
})

test("CRM-007 chuyển đổi bị backend từ chối: hiện thông điệp của backend (CRM_011)", async ({ page }) => {
  await crm(page)
  await mockApi(page, "/v1/crm/leads", { method: "GET", body: pageOf(LEADS) })
  await mockApi(page, "/v1/crm/leads/101/convert", {
    method: "POST",
    status: 400,
    body: fail("CRM_011", "Lead này đã được chuyển thành deal 201."),
  })
  await page.goto("/crm/leads")
  await menu(page, "E2E Lan").click()
  await page.getByRole("menuitem", { name: "Chuyển thành deal" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Chuyển thành deal" }).click()
  await expect(page.getByText("Lead này đã được chuyển thành deal 201.")).toBeVisible()
  await expect(page.getByRole("dialog")).toBeVisible()
})

test("CRM-008 chi tiết lead: các tab, thêm công việc gửi TaskForm, đổi giai đoạn gửi MoveForm", async ({ page }) => {
  await crm(page)
  await mockApi(page, "/v1/crm/leads/101", { method: "GET", body: ok(LEAD_DETAIL) })
  const addTask = await mockApi(page, "/v1/crm/leads/101/tasks", { method: "POST", body: ok({ id: "702" }) })
  const move = await mockApi(page, "/v1/crm/leads/101/stage", { method: "PUT", body: ok(LEAD_DETAIL) })
  await page.goto("/crm/leads/101")
  await expect(page.getByRole("heading", { name: "E2E Lan" })).toBeVisible()
  await expect(page.getByText("E2E comment")).toBeVisible()
  await page.getByRole("tab", { name: /Công việc/ }).click()
  await expect(page).toHaveURL(/tab=tasks/)
  await expect(page.getByRole("row").filter({ hasText: "E2E Call back" })).toContainText("09:30")

  await page.getByRole("button", { name: "Thêm công việc" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên").fill("E2E Send offer")
  await dialog.getByLabel("Ngày").fill("2026-11-30")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => addTask.length).toBe(1)
  expect(addTask[0]).toEqual({ name: "E2E Send offer", date: "2026-11-30", time: null, priority: "MEDIUM", status: "OPEN" })

  await page.getByRole("combobox", { name: "Giai đoạn" }).click()
  await page.getByRole("option", { name: "Qualified" }).click()
  await expect.poll(() => move.length).toBe(1)
  expect(move[0]).toEqual({ stageId: 12 })
})

test("CRM-009 deal: board có số lượng và tổng tiền mỗi giai đoạn; đánh dấu thắng gửi StatusForm", async ({ page }) => {
  await crm(page)
  await mockApi(page, "/v1/crm/deals/board", { body: ok(DEAL_BOARD) })
  const status = await mockApi(page, "/v1/crm/deals/201/status", { method: "PUT", body: ok({ deal: DEALS[0] }) })
  await page.goto("/crm/deals?mode=board")
  const proposal = page.getByRole("region", { name: "Proposal" })
  await expect(proposal).toContainText("250.000.000")
  await expect(page.getByRole("region", { name: "Won" })).toContainText("Thắng")
  await menu(page, "E2E License deal").click()
  await page.getByRole("menuitem", { name: "Đánh dấu thắng" }).click()
  await expect.poll(() => status.length).toBe(1)
  expect(status[0]).toEqual({ status: "WON" })
})

test("CRM-010 thiết lập: đổi thứ tự giai đoạn gửi đủ danh sách (CRM_020), tạo nguồn gửi NameForm", async ({ page }) => {
  await crm(page)
  const order = await mockApi(page, "/v1/crm/pipelines/1/stages/order", { method: "PUT", body: ok(PIPELINES[0]) })
  const source = await mockApi(page, "/v1/crm/sources", { method: "POST", body: ok({ id: "42" }) })
  await page.goto("/crm/setup")
  await page.getByRole("button", { name: "Chuyển Qualified lên" }).click()
  await expect.poll(() => order.length).toBe(1)
  expect(order[0]).toEqual({ kind: "LEAD", stageIds: [12, 11] })
  await expect(page.getByRole("button", { name: "Chuyển New lên" })).toBeDisabled()

  await page.getByRole("tab", { name: "Nguồn" }).click()
  await page.getByRole("button", { name: "Tạo nguồn" }).click()
  await page.getByRole("dialog").getByLabel("Tên").fill("E2E Referral")
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => source.length).toBe(1)
  expect(source[0]).toEqual({ name: "E2E Referral" })
})

test("CRM-011 báo cáo: tên nhân viên lấy từ /iam/users, theo giai đoạn cần chọn pipeline", async ({ page }) => {
  await crm(page)
  const leads = await mockApi(page, "/v1/crm/reports/leads", {
    body: ok({
      year: 2026,
      total: 5,
      converted: 2,
      conversionPercent: 40,
      byStage: [],
      bySource: [{ id: "41", name: "E2E Website", count: 3 }],
      byMonth: [{ month: 11, created: 5, converted: 2 }],
      byUser: [{ id: "9001", name: null, count: 5 }],
    }),
  })
  await mockApi(page, "/v1/crm/reports/deals", { body: ok({ year: 2026, total: 0, totalValue: 0, byStatus: {}, byStage: [], bySource: [], byMonth: [] }) })
  await page.goto("/crm/reports")
  await expect(page.getByText("40%")).toBeVisible()
  await expect(page.getByText("E2E Admin")).toBeVisible()
  await expect(page.getByText("Chọn một pipeline để xem theo giai đoạn.")).toBeVisible()
  await page.getByRole("combobox", { name: "Pipeline" }).click()
  await page.getByRole("option", { name: "E2E Pipeline" }).click()
  await expect.poll(() => leads.requests.at(-1)?.url.searchParams.get("pipelineId")).toBe("1")
})

test("CRM-012 lead và deal có nút Lịch công việc mở lịch chung lọc theo loại công việc", async ({ page }) => {
  await crm(page)
  await mockApi(page, "/v1/crm/leads", { method: "GET", body: pageOf(LEADS) })
  await mockApi(page, "/v1/crm/deals", { method: "GET", body: pageOf([]) })
  await page.goto("/crm/leads")
  await expect(page.getByRole("link", { name: "Lịch công việc" })).toHaveAttribute("href", "/calendar?kinds=LEAD_TASK")
  await page.goto("/crm/deals")
  await expect(page.getByRole("link", { name: "Lịch công việc" })).toHaveAttribute("href", "/calendar?kinds=DEAL_TASK")
})
