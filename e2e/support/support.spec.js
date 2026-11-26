// @ts-check
/**
 * Support & communication (manual §18). Spec sources: support-service TicketController (TicketForm {accountType, name,
 * email, categoryId, subject, description, status, attachmentFileIds, customFields[{fieldId, value}]}; /replies ReplyForm;
 * SUP_006 closed), KnowledgeController (KB category form is {title} although Swagger shows {name, color}; CSV import),
 * MessengerController (/conversations/{userId}/messages SendForm {body}), PublicSupportController (no auth; /tickets,
 * /tickets/track {ticketNumber, email}, /contact).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, LANGUAGES, mockApi, mockLoggedIn, ok, pageOf, publicSettings } from "../utils/mock-api.js"

const ALL = ["SUPPORT_TICKET_VIEW", "SUPPORT_TICKET_MANAGE", "SUPPORT_KB_VIEW", "SUPPORT_KB_MANAGE", "SUPPORT_CONTACT_VIEW", "SUPPORT_CONTACT_MANAGE", "SUPPORT_SETTINGS_MANAGE", "MESSENGER_USE", "IAM_USER_VIEW"]
const CATEGORIES = [{ id: "1", name: "E2E Technical", color: "#2563EB" }]
const FIELDS = [{ id: "4", label: "E2E Severity", type: "SELECT", options: ["Low", "High"], required: true, width: 12, order: 0, active: true }]

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/support/ticket-categories", { method: "GET", body: ok(CATEGORIES) })
  await mockApi(page, "/v1/support/ticket-fields", { method: "GET", body: ok(FIELDS) })
}

test("SP-001 phiếu: tạo kèm trường tùy chỉnh bắt buộc, gửi TicketForm (customFields) @smoke", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/support/tickets", { method: "GET", body: pageOf([]) })
  const create = await mockApi(page, "/v1/support/tickets", { method: "POST", body: ok({ ticket: {}, trackingToken: "x" }) })
  await page.goto("/support/tickets")
  await page.getByRole("button", { name: "Tạo phiếu" }).click()
  const d = page.getByRole("dialog")
  await d.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Technical" }).click()
  await d.getByLabel("Tên *").fill("E2E Hung")
  await d.getByLabel("Email *").fill("hung@example.com")
  await d.getByLabel("Tiêu đề *").fill("E2E Printer")
  await d.getByLabel("Mô tả *").fill("E2E It does not print.")
  const save = d.getByRole("button", { name: "Lưu thay đổi" })
  await expect(save).toBeDisabled()
  await d.getByRole("combobox", { name: "E2E Severity" }).click()
  await page.getByRole("option", { name: "High" }).click()
  await save.click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    accountType: "CUSTOM",
    categoryId: 1,
    name: "E2E Hung",
    email: "hung@example.com",
    subject: "E2E Printer",
    status: "IN_PROGRESS",
    description: "E2E It does not print.",
    attachmentFileIds: [],
    customFields: [{ fieldId: 4, value: "High" }],
  })
})

test("SP-002 phiếu: trả lời gửi ReplyForm; phiếu đã đóng không cho trả lời", async ({ page }) => {
  await base(page)
  const rows = [
    { id: "1", ticketNumber: "TKT-000001", subject: "E2E Open", status: "IN_PROGRESS", categoryId: "1", categoryName: "E2E Technical" },
    { id: "2", ticketNumber: "TKT-000002", subject: "E2E Closed", status: "CLOSED", categoryId: "1", categoryName: "E2E Technical" },
  ]
  await mockApi(page, "/v1/support/tickets", { method: "GET", body: pageOf(rows) })
  await mockApi(page, "/v1/support/tickets/1", { method: "GET", body: ok({ ticket: rows[0], description: "E2E help", replies: [{ id: "9", senderType: "CUSTOMER", senderName: "E2E Hung", description: "E2E still broken" }] }) })
  await mockApi(page, "/v1/support/tickets/2", { method: "GET", body: ok({ ticket: rows[1], description: "E2E done", replies: [] }) })
  const reply = await mockApi(page, "/v1/support/tickets/1/replies", { method: "POST", body: ok({}) })
  await page.goto("/support/tickets")
  await page.getByRole("button", { name: "TKT-000001", exact: true }).click()
  const d = page.getByRole("dialog")
  await expect(d).toContainText("E2E still broken")
  await d.getByLabel("Trả lời").fill("E2E restart it")
  await d.getByRole("button", { name: "Gửi" }).click()
  await expect.poll(() => reply.length).toBe(1)
  expect(reply[0]).toEqual({ description: "E2E restart it", attachmentFileIds: [] })
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "TKT-000002", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("Phiếu đã đóng: không thể trả lời thêm.")
  await expect(page.getByRole("dialog").getByLabel("Trả lời")).toHaveCount(0)
})

test("SP-010 kho kiến thức: danh mục gửi {title}; nhập CSV FAQ hiện kết quả và lỗi từng dòng", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/support/kb-categories", { method: "GET", body: ok([]) })
  const cat = await mockApi(page, "/v1/support/kb-categories", { method: "POST", body: ok({ id: "1", title: "E2E Account" }) })
  await mockApi(page, "/v1/support/faqs", { method: "GET", body: pageOf([]) })
  const imp = await mockApi(page, "/v1/support/faqs/import", { method: "POST", body: ok({ rows: 2, created: 1, errors: [{ row: 3, message: 'Row 3: "description" is required.' }] }) })
  await page.goto("/support/knowledge?tab=categories")
  await page.getByRole("button", { name: "Thêm danh mục" }).click()
  await page.getByRole("dialog").getByLabel("Tiêu đề *").fill("E2E Account")
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => cat.length).toBe(1)
  expect(cat[0]).toEqual({ title: "E2E Account" })
  await page.goto("/support/knowledge?tab=faqs")
  await page.getByLabel("Nhập FAQ từ CSV (title, description)").setInputFiles({ name: "faq.csv", mimeType: "text/csv", buffer: Buffer.from("title,description\nQ1,A1\nQ2,\n") })
  await expect(page.getByRole("dialog")).toContainText("Đã tạo 1/2 dòng.")
  await expect(page.getByTestId("import-errors")).toContainText("Row 3")
  expect(String(imp.requests[0].body)).toContain('filename="faq.csv"')
})

test("SP-020 messenger: chọn đồng nghiệp, gửi tin (SendForm), yêu thích", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/iam/users", { body: pageOf([{ id: "9001", fullName: "E2E Me" }, { id: "283", fullName: "E2E An" }]) })
  await mockApi(page, "/v1/messenger/conversations", { body: pageOf([{ userId: "283", unreadCount: 2, favorite: false, lastMessage: { body: "E2E hi" } }]) })
  await mockApi(page, "/v1/messenger/conversations/283/messages", { method: "GET", body: pageOf([{ id: "1", body: "E2E hi", mine: false, seen: false, createdDate: "2026-11-22T08:00:00Z" }]) })
  const send = await mockApi(page, "/v1/messenger/conversations/283/messages", { method: "POST", body: ok({ id: "2" }) })
  const read = await mockApi(page, "/v1/messenger/conversations/283/read", { method: "POST", body: ok({ marked: 1 }) })
  const fav = await mockApi(page, "/v1/messenger/favorites/283", { method: "PUT", body: ok({}) })
  await page.goto("/messenger")
  await expect(page.getByRole("list", { name: "Cuộc trò chuyện" })).not.toContainText("E2E Me")
  await expect(page.getByLabel("2 chưa đọc")).toBeVisible()
  await page.getByRole("button", { name: /E2E An/ }).click()
  await expect(page.getByTestId("chat-with")).toHaveText("E2E An")
  await expect(page.getByRole("log")).toContainText("E2E hi")
  await expect.poll(() => read.requests.length).toBeGreaterThan(0)
  await page.getByLabel("Nhập tin nhắn").fill("E2E see you at 3")
  await page.getByRole("button", { name: "Gửi" }).click()
  await expect.poll(() => send.length).toBe(1)
  expect(send[0]).toEqual({ body: "E2E see you at 3" })
  await page.getByRole("button", { name: "Thêm vào yêu thích" }).click()
  await expect.poll(() => fav.requests.length).toBe(1)
})

test("SP-030 cổng hỗ trợ công khai: tạo phiếu (trường tùy chỉnh), tra cứu theo số + email, gửi liên hệ — không gửi token", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 599, contentType: "application/json", body: JSON.stringify(fail("E2E_UNMOCKED", route.request().url())) }))
  await mockApi(page, "/v1/settings/public", { body: publicSettings() })
  await mockApi(page, "/v1/languages", { body: LANGUAGES })
  await mockApi(page, "/v1/public/support/e2e-help", { body: ok({ slug: "e2e-help", brandName: "E2E Help", content: {}, pages: [], ticketCategories: CATEGORIES, kbCategories: [], ticketFields: FIELDS }) })
  const create = await mockApi(page, "/v1/public/support/e2e-help/tickets", { method: "POST", body: ok({ ticketNumber: "TKT-000009", trackingToken: "t", status: "IN_PROGRESS" }) })
  const track = await mockApi(page, "/v1/public/support/e2e-help/tickets/track", { method: "POST", body: ok({ ticketNumber: "TKT-000009", subject: "E2E Login", status: "ON_HOLD", replies: [] }) })
  const contact = await mockApi(page, "/v1/public/support/e2e-help/contact", { method: "POST", body: ok(null) })
  await page.goto("/help/e2e-help")
  await expect(page.getByRole("heading", { name: "E2E Help" })).toBeVisible()
  await page.getByRole("tab", { name: "Tạo phiếu hỗ trợ" }).click()
  await page.getByLabel("Tên *").fill("E2E Hung")
  await page.getByLabel("Email *").fill("hung@example.com")
  await page.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Technical" }).click()
  await page.getByLabel("Tiêu đề *").fill("E2E Login")
  await page.getByLabel("Mô tả *").fill("E2E cannot sign in")
  await page.getByRole("button", { name: "Gửi phiếu" }).click()
  await expect(page.getByText("Bắt buộc")).toBeVisible()
  expect(create.length).toBe(0)
  await page.getByRole("combobox", { name: "E2E Severity" }).click()
  await page.getByRole("option", { name: "Low" }).click()
  await page.getByRole("button", { name: "Gửi phiếu" }).click()
  await expect(page.getByTestId("ticket-number")).toHaveText("TKT-000009")
  expect(create[0]).toEqual({ name: "E2E Hung", email: "hung@example.com", categoryId: 1, subject: "E2E Login", description: "E2E cannot sign in", customFields: [{ fieldId: 4, value: "Low" }] })
  expect(create.requests[0].headers.authorization).toBeUndefined()

  await page.getByRole("tab", { name: "Tra cứu phiếu" }).click()
  await page.getByLabel("Số phiếu").fill("TKT-000009")
  await page.getByLabel("Email").fill("hung@example.com")
  await page.getByRole("button", { name: "Xem trạng thái" }).click()
  await expect(page.getByTestId("ticket-status")).toHaveText("Tạm dừng")
  expect(track[0]).toEqual({ ticketNumber: "TKT-000009", email: "hung@example.com" })

  await page.getByRole("tab", { name: "Liên hệ" }).click()
  await page.getByLabel("Tên *").fill("E2E Lan")
  await page.getByLabel("Email *").fill("lan@example.com")
  await page.getByLabel("Tiêu đề *").fill("E2E Partner")
  await page.getByLabel("Nội dung *").fill("E2E hello")
  await page.getByRole("button", { name: "Gửi" }).click()
  await expect(page.getByText("Cảm ơn, tin nhắn của bạn đã được gửi.")).toBeVisible()
  expect(contact[0]).toEqual({ name: "E2E Lan", email: "lan@example.com", subject: "E2E Partner", message: "E2E hello" })
})

test("SP-003 phiếu: tab trạng thái có số đếm từ /tickets/status-counts (khóa camelCase)", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/support/tickets", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/support/tickets/status-counts", { body: ok({ all: 20, inProgress: 10, onHold: 4, closed: 6 }) })
  await page.goto("/support/tickets")
  await expect(page.getByRole("tab", { name: "Tất cả (20)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Đang thực hiện (10)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Tạm dừng (4)" })).toBeVisible()
})

test("SP-004 phiếu: số đếm gửi cùng bộ lọc danh mục và từ khóa của danh sách", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/support/tickets", { method: "GET", body: pageOf([]) })
  const counts = await mockApi(page, "/v1/support/tickets/status-counts", { body: ok({ all: 1, inProgress: 1, onHold: 0, closed: 0 }) })
  await page.goto("/support/tickets?q=E2E")
  await expect(page.getByRole("tab", { name: "Tất cả (1)" })).toBeVisible()
  expect(counts.requests.at(-1)?.url.searchParams.get("keyword")).toBe("E2E")
})

test("SP-021 messenger: ghim lên đầu (PUT/DELETE /pin), chấm trực tuyến, hoạt động lúc; tín hiệu presence; số chưa đọc trên menu", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/iam/users", { body: pageOf([{ id: "9001", fullName: "E2E Me" }, { id: "283", fullName: "E2E An" }, { id: "284", fullName: "E2E Bình" }]) })
  await mockApi(page, "/v1/messenger/conversations", {
    body: pageOf([
      { userId: "283", favorite: true, online: true, lastMessage: { body: "E2E mới", createdDate: "2026-11-26T09:00:00Z" } },
      { userId: "284", pinned: true, online: false, lastSeenAt: "2026-11-26T07:30:00Z", lastMessage: { body: "E2E cũ", createdDate: "2026-11-20T08:00:00Z" } },
    ]),
  })
  await mockApi(page, "/v1/messenger/conversations/284/messages", { method: "GET", body: pageOf([]) })
  const presence = await mockApi(page, "/v1/messenger/presence", { method: "PUT", body: ok(null) })
  await mockApi(page, "/v1/messenger/unread-count", { body: ok({ total: 3 }) })
  const unpin = await mockApi(page, "/v1/messenger/conversations/284/pin", { method: "DELETE", body: ok(null) })
  await page.goto("/messenger")
  const items = page.getByRole("list", { name: "Cuộc trò chuyện" }).getByRole("button")
  await expect(items.first()).toContainText("E2E Bình") // pinned before the favorite with a newer message
  await expect(items.nth(1).getByRole("img", { name: "Đang hoạt động" })).toBeVisible()
  await expect(items.first().getByRole("img", { name: "Đang hoạt động" })).toHaveCount(0)
  await expect.poll(() => presence.requests.length).toBeGreaterThan(0)
  await expect(page.getByLabel("Tin nhắn: 3")).toBeVisible()
  await items.first().click()
  await expect(page.getByTestId("chat-presence")).toContainText("Hoạt động lúc")
  await page.getByRole("button", { name: "Bỏ ghim cuộc trò chuyện" }).click()
  await expect.poll(() => unpin.requests.length).toBe(1)
})

test("SP-022 thống kê ticket: thẻ tổng, phản hồi đầu, theo trạng thái / danh mục, biểu đồ tháng; đổi năm gửi year + tz", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/support/ticket-categories", { method: "GET", body: ok([]) })
  await mockApi(page, "/v1/support/ticket-fields", { method: "GET", body: ok([]) })
  const stats = await mockApi(page, "/v1/support/tickets/stats", {
    body: ok({ scope: "COMPANY", year: 2026, total: 12, open: 5, closed: 7, today: 1, averageFirstResponseMinutes: 95, byStatus: { IN_PROGRESS: 4, ON_HOLD: 1, CLOSED: 7 }, byCategory: [{ categoryId: "1", name: "E2E Billing", count: 8 }], kbArticles: 3, faqs: 6, monthly: [{ month: 11, created: 4, closed: 2 }] }),
  })
  await page.goto("/support/tickets?tab=stats")
  await expect(page.getByTestId("sp-stat-total")).toHaveText("12")
  await expect(page.getByTestId("sp-stat-first-response")).toHaveText("1.6 giờ")
  await expect(page.getByTestId("sp-status-ON_HOLD")).toContainText("1")
  await expect(page.getByText("E2E Billing")).toBeVisible()
  expect(stats.requests[0].url.searchParams.get("tz")).toBeTruthy()
  await page.getByRole("combobox", { name: "Năm" }).click()
  await page.getByRole("option", { name: String(new Date().getFullYear() - 1) }).click()
  await expect.poll(() => stats.requests.at(-1)?.url.searchParams.get("year")).toBe(String(new Date().getFullYear() - 1))
})

test("SP-023 ticket của tôi (PORTAL_CLIENT): danh sách theo trạng thái, gửi yêu cầu (PortalTicketForm, mô tả thành đoạn HTML), trả lời; phiếu đóng không trả lời", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["PORTAL_CLIENT"] })
  const list = await mockApi(page, "/v1/portal/client/tickets", { method: "GET", body: pageOf([{ id: "7", ticketNumber: "TKT-000007", subject: "E2E Không tải được hóa đơn", categoryName: "E2E Billing", status: "IN_PROGRESS", updatedDate: "2026-11-26T08:00:00Z" }, { id: "8", ticketNumber: "TKT-000008", subject: "E2E Đã xong", status: "CLOSED" }]) })
  await mockApi(page, "/v1/portal/client/tickets/categories", { body: ok([{ id: "1", name: "E2E Billing" }]) })
  await mockApi(page, "/v1/portal/client/tickets/fields", {
    body: ok([
      { id: "7", label: "E2E Mức độ", type: "SELECT", options: ["Thấp", "Cao"], required: true, width: 6, order: 1, active: true },
      { id: "8", label: "E2E Email liên hệ", type: "EMAIL", required: false, width: 6, order: 2, active: true },
      { id: "9", label: "E2E Ghi chú", type: "TEXTAREA", required: false, width: 12, order: 3, active: true },
    ]),
  })
  const create = await mockApi(page, "/v1/portal/client/tickets", { method: "POST", body: ok({ ticket: { id: "9" } }) })
  await mockApi(page, "/v1/portal/client/tickets/9", { body: ok({ ticket: { id: "9", ticketNumber: "TKT-000009", subject: "E2E Mới", status: "IN_PROGRESS" }, description: "<p>a &lt;b&gt;</p>", replies: [] }) })
  await mockApi(page, "/v1/portal/client/tickets/8", { body: ok({ ticket: { id: "8", subject: "E2E Đã xong", status: "CLOSED" }, description: "<p>x</p>", replies: [{ senderType: "STAFF", description: "<p>Đã xử lý</p>", createdDate: "2026-11-25T08:00:00Z" }] }) })
  const reply = await mockApi(page, "/v1/portal/client/tickets/9/replies", { method: "POST", body: ok({}) })
  await page.goto("/portal/tickets")
  await expect(page.getByRole("link", { name: "Ticket của tôi" })).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "TKT-000007" })).toContainText("E2E Billing")
  await page.getByRole("tab", { name: "Đã đóng" }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("status")).toBe("CLOSED")
  await page.getByRole("button", { name: "E2E Đã xong" }).click()
  await expect(page.getByRole("log")).toContainText("Đã xử lý")
  await expect(page.getByText("Yêu cầu đã đóng, không thể phản hồi thêm.")).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Gửi yêu cầu mới" }).click()
  const d = page.getByRole("dialog")
  await d.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Billing" }).click()
  await d.getByLabel("Tiêu đề").fill("E2E Mới")
  await d.getByLabel("Nội dung").fill("dòng 1 <b>\ndòng 2")
  await expect(d.getByRole("button", { name: "Gửi", exact: true })).toBeDisabled() // required "E2E Mức độ" not chosen
  await d.getByLabel("E2E Email liên hệ").fill("sai")
  await expect(d.getByText("Nhập email hợp lệ")).toBeVisible()
  await d.getByLabel("E2E Email liên hệ").fill("")
  await d.getByRole("combobox", { name: "E2E Mức độ" }).click()
  await page.getByRole("option", { name: "Cao" }).click()
  await d.getByRole("button", { name: "Gửi", exact: true }).click()
  await expect.poll(() => create.requests.length).toBe(1)
  expect(create.requests[0].body).toEqual({ categoryId: 1, subject: "E2E Mới", description: "<p>dòng 1 &lt;b&gt;</p><p>dòng 2</p>", customFields: [{ fieldId: 7, value: "Cao" }] })
  const view = page.getByRole("dialog")
  await expect(view.getByTestId("pt-description")).toHaveText("a <b>")
  await view.getByLabel("Viết phản hồi").fill("cảm ơn")
  await view.getByRole("button", { name: "Gửi phản hồi" }).click()
  await expect.poll(() => reply.requests.length).toBe(1)
  expect(reply.requests[0].body).toEqual({ description: "<p>cảm ơn</p>" })
})
