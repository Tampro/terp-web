// @ts-check
/**
 * §15 Events. Spec: meeting-service EventController under /v1/meeting (EVENT_VIEW / EVENT_MANAGE / EVENT_APPROVE):
 * EventForm {title, eventTypeId, startDate, endDate, startTime?, endTime? (both omitted = all day), location, color,
 * departmentIds ≥1, description}; PUT /events/{id}/approve|reject while PENDING; GET /events/calendar?from&to (approved,
 * ≤92 days); event types {name, description, status}, a type with events can't be deleted (MTG_004).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const EVENT = {
  id: "5", title: "E2E Year-end party", eventType: { id: "1", name: "E2E Team Building" }, startDate: "2026-11-27", endDate: "2026-11-27",
  startTime: "18:00:00", endTime: "21:30:00", location: "E2E Hall", color: "#3B82F6", departments: [{ id: "22", name: "E2E Accounting" }], status: "PENDING",
}

/** @param {import('@playwright/test').Page} page @param {string[]} permissions */
async function base(page, permissions = ["EVENT_VIEW", "EVENT_MANAGE", "EVENT_APPROVE"]) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/org/departments/options", { body: ok([{ id: "22", name: "E2E Accounting" }]) })
  await mockApi(page, "/v1/meeting/event-types/options", { body: ok([{ id: "1", name: "E2E Team Building" }]) })
}
/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("EV-001 tạo sự kiện gửi EventForm (giờ, phòng ban); bỏ một giờ thì báo lỗi @smoke", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/meeting/events", { method: "GET", body: pageOf([]) })
  const create = await mockApi(page, "/v1/meeting/events", { method: "POST", body: ok(EVENT) })
  await page.goto("/hrm/events")
  await page.getByRole("button", { name: "Thêm sự kiện" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Tiêu đề *").fill("E2E Year-end party")
  await dlg.getByRole("combobox", { name: "Loại sự kiện" }).click()
  await page.getByRole("option", { name: "E2E Team Building" }).click()
  await dlg.getByLabel("Ngày bắt đầu *").fill("2026-11-27")
  await dlg.getByLabel("Ngày kết thúc *").fill("2026-11-27")
  await dlg.getByLabel("Bắt đầu", { exact: true }).fill("18:00")
  await expect(dlg.getByText("Nhập cả giờ bắt đầu và kết thúc").first()).toBeVisible()
  await dlg.getByLabel("Kết thúc", { exact: true }).fill("21:30")
  await dlg.getByLabel("Địa điểm").fill("E2E Hall")
  await dlg.getByRole("checkbox", { name: "E2E Accounting" }).check()
  await dlg.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ title: "E2E Year-end party", eventTypeId: 1, color: "#3B82F6", startDate: "2026-11-27", endDate: "2026-11-27", startTime: "18:00", endTime: "21:30", location: "E2E Hall", departmentIds: [22] })
})

test("EV-002 duyệt sự kiện đang chờ; người chỉ có EVENT_APPROVE không thấy nút thêm", async ({ page }) => {
  await base(page, ["EVENT_VIEW", "EVENT_APPROVE"])
  await mockApi(page, "/v1/meeting/events", { method: "GET", body: pageOf([EVENT]) })
  const approve = await mockApi(page, "/v1/meeting/events/5/approve", { method: "PUT", body: ok({ ...EVENT, status: "APPROVED" }) })
  await page.goto("/hrm/events")
  await expect(page.getByRole("row").filter({ hasText: "E2E Year-end party" })).toContainText("18:00–21:30")
  await expect(page.getByRole("button", { name: "Thêm sự kiện" })).toHaveCount(0)
  await menu(page, "E2E Year-end party").click()
  await expect(page.getByRole("menuitem", { name: "Sửa" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approve.length).toBe(1)
})

test("EV-003 lịch tháng: hiện sự kiện đã duyệt theo ngày, chuyển tháng gọi lại /calendar", async ({ page }) => {
  await base(page)
  await page.clock.setFixedTime(new Date("2026-11-20T10:00:00"))
  const cal = await mockApi(page, "/v1/meeting/events/calendar", { body: ok([{ ...EVENT, status: "APPROVED", endDate: "2026-11-28" }]) })
  await page.goto("/hrm/events?tab=calendar")
  await expect(page.getByTestId("day-2026-11-27")).toContainText("18:00 E2E Year-end party")
  await expect(page.getByTestId("day-2026-11-28")).toContainText("E2E Year-end party")
  await expect(page.getByTestId("day-2026-11-28")).not.toContainText("18:00")
  expect(cal.requests[0].url.searchParams.get("from")).toBe("2026-10-26")
  expect(cal.requests[0].url.searchParams.get("to")).toBe("2026-12-06")
  await page.getByRole("button", { name: "Tháng sau" }).click()
  await expect(page.getByTestId("event-month")).toContainText("12")
  await expect.poll(() => cal.requests.length).toBe(2)
})

test("EV-004 loại sự kiện: loại đã có sự kiện không có nút xóa", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/meeting/event-types", { method: "GET", body: pageOf([{ id: "1", name: "E2E Team Building", status: "ACTIVE", totalEvents: 2 }, { id: "2", name: "E2E Seminar", status: "ACTIVE", totalEvents: 0 }]) })
  await page.goto("/hrm/events?tab=types")
  await menu(page, "E2E Team Building").click()
  await expect(page.getByRole("menuitem", { name: "Xóa" })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await menu(page, "E2E Seminar").click()
  await expect(page.getByRole("menuitem", { name: "Xóa" })).toBeVisible()
})
