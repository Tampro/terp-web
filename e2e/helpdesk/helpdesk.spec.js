// @ts-check
/**
 * §3.3 Platform helpdesk. Spec: iam-service HelpdeskController /v1/helpdesk: company users (HELPDESK_VIEW / _CREATE) open
 * tickets without a priority (HDK_009) and reply; the super admin opens one for a company (companyId), edits (full
 * replacement), posts internal replies, deletes messages, manages categories and reads /stats. The backend stores HTML
 * as given, so the UI sends escaped paragraphs and shows text.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ROW = { id: "9", ticketNumber: "#00000009", title: "E2E Payroll report <b>", companyId: "3", companyName: "E2E Co", categoryId: "2", categoryName: "E2E Reports", categoryColor: "#3B82F6", status: "OPEN", priority: "MEDIUM", createdDate: "2026-11-22T16:10:00Z" }
const DETAIL = {
  ticket: ROW,
  description: "<p>Blank page</p><p>&lt;script&gt;x&lt;/script&gt;</p>",
  replies: [
    { id: "1", message: "<p>E2E from company</p>", internal: false, fromPlatform: false, authorName: "Company Admin", attachmentFileIds: [], createdDate: "2026-11-22T16:11:00Z" },
    { id: "2", message: "<p>E2E internal note</p>", internal: true, fromPlatform: true, authorName: "superadmin", attachmentFileIds: [], createdDate: "2026-11-22T16:12:00Z" },
  ],
}
const CATS = [
  { id: "2", name: "E2E Reports", color: "#3B82F6", active: true },
  { id: "3", name: "E2E Old", color: "#999999", active: false },
]

test("HD-001 công ty: tạo yêu cầu gửi title + mô tả đã escape, không gửi priority; chỉ chọn danh mục đang dùng @smoke", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["HELPDESK_VIEW", "HELPDESK_CREATE"] })
  await mockApi(page, "/v1/helpdesk/categories", { body: ok(CATS.slice(0, 1)) })
  await mockApi(page, "/v1/helpdesk/tickets", { method: "GET", body: pageOf([]) })
  const create = await mockApi(page, "/v1/helpdesk/tickets", { method: "POST", body: ok(DETAIL) })
  await page.goto("/helpdesk")
  await expect(page.getByRole("tab", { name: "Danh mục" })).toHaveCount(0)
  await page.getByRole("button", { name: "Tạo yêu cầu" }).click()
  const dlg = page.getByRole("dialog")
  await expect(dlg.getByRole("combobox", { name: "Mức ưu tiên" })).toHaveCount(0)
  await dlg.getByLabel("Tiêu đề *").fill("E2E Payroll report")
  await dlg.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Reports" }).click()
  await dlg.getByLabel("Mô tả *").fill("Line 1\n<script>x</script> & y")
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ title: "E2E Payroll report", categoryId: 2, description: "<p>Line 1</p><p>&lt;script&gt;x&lt;/script&gt; &amp; y</p>" })
})

test("HD-002 công ty: hội thoại hiện văn bản (không chạy HTML), trả lời không có tùy chọn nội bộ", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["HELPDESK_VIEW", "HELPDESK_CREATE"] })
  await mockApi(page, "/v1/helpdesk/categories", { body: ok(CATS) })
  await mockApi(page, "/v1/helpdesk/tickets", { method: "GET", body: pageOf([ROW]) })
  await mockApi(page, "/v1/helpdesk/tickets/9", { body: ok({ ...DETAIL, replies: DETAIL.replies.slice(0, 1) }) })
  const reply = await mockApi(page, "/v1/helpdesk/tickets/9/replies", { method: "POST", body: ok({ id: "3" }) })
  await page.goto("/helpdesk")
  await page.getByRole("button", { name: "#00000009", exact: true }).click()
  const dlg = page.getByRole("dialog")
  await expect(dlg.getByTestId("hd-description")).toHaveText("Blank page\n<script>x</script>")
  await expect(dlg.getByRole("button", { name: "Sửa" })).toHaveCount(0)
  await expect(dlg.getByText("Ghi chú nội bộ (công ty không thấy)")).toHaveCount(0)
  await dlg.getByLabel("Trả lời").fill("E2E more info")
  await dlg.getByRole("button", { name: "Gửi" }).click()
  await expect.poll(() => reply.length).toBe(1)
  expect(reply[0]).toEqual({ message: "<p>E2E more info</p>" })
})

test("HD-003 Super Admin: trả lời nội bộ, xóa tin nhắn, sửa yêu cầu (trạng thái, ưu tiên)", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/helpdesk/categories", { body: ok(CATS) })
  await mockApi(page, "/v1/iam/companies", { body: pageOf([{ id: "3", name: "E2E Co" }]) })
  await mockApi(page, "/v1/helpdesk/tickets", { method: "GET", body: pageOf([ROW]) })
  await mockApi(page, "/v1/helpdesk/tickets/9", { method: "GET", body: ok(DETAIL) })
  const reply = await mockApi(page, "/v1/helpdesk/tickets/9/replies", { method: "POST", body: ok({ id: "3" }) })
  const delReply = await mockApi(page, "/v1/helpdesk/tickets/9/replies/2", { method: "DELETE", body: ok(null) })
  const put = await mockApi(page, "/v1/helpdesk/tickets/9", { method: "PUT", body: ok(DETAIL) })
  await page.goto("/helpdesk")
  await expect(page.getByRole("row").filter({ hasText: "#00000009" })).toContainText("E2E Co")
  await page.getByRole("button", { name: "#00000009", exact: true }).click()
  const dlg = page.getByRole("dialog")
  await expect(dlg.getByTestId("hd-reply").nth(1)).toContainText("Nội bộ")
  await dlg.getByLabel("Trả lời").fill("E2E note")
  await dlg.getByRole("switch", { name: "Ghi chú nội bộ (công ty không thấy)" }).click()
  await dlg.getByRole("button", { name: "Gửi" }).click()
  await expect.poll(() => reply.length).toBe(1)
  expect(reply[0]).toEqual({ message: "<p>E2E note</p>", internal: true })
  await dlg.getByRole("button", { name: "Xóa tin nhắn" }).nth(1).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
  await expect.poll(() => delReply.length).toBe(1)
  await dlg.getByRole("button", { name: "Sửa" }).click()
  const edit = page.getByRole("dialog")
  await edit.getByRole("combobox", { name: "Trạng thái" }).click()
  await page.getByRole("option", { name: "Đã giải quyết" }).click()
  await edit.getByRole("combobox", { name: "Mức ưu tiên" }).click()
  await page.getByRole("option", { name: "Khẩn cấp" }).click()
  await edit.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ title: "E2E Payroll report <b>", categoryId: 2, priority: "URGENT", status: "RESOLVED", description: "<p>Blank page</p><p>&lt;script&gt;x&lt;/script&gt;</p>" })
})

test("HD-004 Super Admin: tab thống kê theo năm và tạo danh mục", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await page.clock.setFixedTime(new Date("2026-11-20T10:00:00"))
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, created: i === 10 ? 9 : 0, resolved: 0 }))
  const stats = await mockApi(page, "/v1/helpdesk/stats", { body: ok({ year: 2026, months, byStatus: { OPEN: 4, IN_PROGRESS: 1, RESOLVED: 0, CLOSED: 4 }, total: 9 }) })
  await mockApi(page, "/v1/helpdesk/categories", { method: "GET", body: ok(CATS) })
  const create = await mockApi(page, "/v1/helpdesk/categories", { method: "POST", body: ok(CATS[0]) })
  await page.goto("/helpdesk?tab=stats")
  await expect(page.getByTestId("hd-total")).toHaveText("9")
  await expect(page.getByTestId("hd-count-CLOSED")).toHaveText("4")
  expect(stats.requests[0].url.searchParams.get("year")).toBe("2026")
  await page.getByRole("tab", { name: "Danh mục" }).click()
  await page.getByRole("button", { name: "Thêm danh mục" }).click()
  await page.getByRole("dialog").getByLabel("Tên *").fill("E2E Billing")
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ name: "E2E Billing", color: "#3B82F6", active: true })
})
