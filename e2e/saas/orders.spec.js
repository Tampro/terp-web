// @ts-check
/**
 * Orders & plan requests (manual §4.3, §4.5).
 * Spec sources: SaasAdminController GET /saas/admin/orders (keyword, dateFrom/To, status) + /status-counts,
 * POST /orders/{id}/approve|reject {notes} only while PENDING (SAAS_009); GET /saas/admin/plan-requests + approve/reject;
 * SubscriptionController GET /saas/orders, POST /saas/orders/{id}/cancel, GET/POST /saas/plan-requests(/{id}/cancel);
 * receipt opened through GET /media/files/{id} (fresh signed viewUrl).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { ADMIN_ORDERS, ORDER_APPROVED, ORDER_COUNTS, ORDER_PENDING, PLAN_REQUESTS, PLANS, SAAS_PERMISSIONS } from "./data.js"

/** @param {import('@playwright/test').Page} page */
async function openAdminOrders(page) {
  await mockLoggedIn(page, { superAdmin: true })
  const list = await mockApi(page, "/v1/saas/admin/orders", { method: "GET", body: pageOf(ADMIN_ORDERS) })
  await mockApi(page, "/v1/saas/admin/orders/status-counts", { body: ok(ORDER_COUNTS) })
  await page.goto("/orders")
  await expect(page.getByText("ORD-E2E-0071", { exact: true })).toBeVisible()
  return { list }
}

test("ORD-001 danh sách đơn: tiền sau giảm, giá gốc gạch, số đếm tab; lọc tab gửi status @smoke", async ({ page }) => {
  const { list } = await openAdminOrders(page)
  const row = page.getByRole("row").filter({ hasText: "ORD-E2E-0071" })
  await expect(row).toContainText("441.000")
  await expect(row).toContainText("490.000")
  await expect(row).toContainText("Chờ duyệt")
  await expect(page.getByRole("tab", { name: "Chờ duyệt (1)" })).toBeVisible()
  await page.getByRole("tab", { name: /Chờ duyệt/ }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("status")).toBe("PENDING")
  await expect(page).toHaveURL(/status=PENDING/)
})

test("ORD-002 duyệt đơn chờ kèm ghi chú; đơn đã duyệt không duyệt lại được", async ({ page }) => {
  const { list } = await openAdminOrders(page)
  const approve = await mockApi(page, "/v1/saas/admin/orders/71/approve", { body: ok({ ...ORDER_PENDING, status: "APPROVED" }) })

  await page.getByRole("button", { name: "Thao tác cho đơn ORD-E2E-0070" }).click()
  await expect(page.getByRole("menuitem", { name: "Duyệt" })).toBeDisabled()
  await page.keyboard.press("Escape")

  const before = list.requests.length
  await page.getByRole("button", { name: "Thao tác cho đơn ORD-E2E-0071" }).click()
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Duyệt đơn ORD-E2E-0071?")
  await dialog.getByLabel("Ghi chú").fill("Đã nhận tiền")
  await dialog.getByRole("button", { name: "Duyệt" }).click()
  // not getByText("Đã duyệt"): the approved row already shows that badge (would pass before the request)
  await expect(dialog).toBeHidden()
  await expect.poll(() => approve.length).toBe(1)
  expect(approve).toEqual([{ notes: "Đã nhận tiền" }])
  await expect.poll(() => list.requests.length).toBe(before + 1) // list reloaded
})

test("ORD-003 xem chi tiết đơn và mở biên lai qua link media mới", async ({ page }) => {
  await openAdminOrders(page)
  const file = await mockApi(page, "/v1/media/files/900", { body: ok({ id: "900", viewUrl: "https://media.example/e2e-receipt.pdf" }) })
  // the signed link opens in a new tab: answer it locally (no network in tests)
  await page.context().route("https://media.example/**", (r) => r.fulfill({ contentType: "text/html", body: "<p>e2e receipt</p>" }))
  await page.getByRole("button", { name: "Thao tác cho đơn ORD-E2E-0071" }).click()
  await page.getByRole("menuitem", { name: "Xem" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("E2E10")
  await expect(dialog).toContainText("-49.000")
  const popup = page.waitForEvent("popup")
  await dialog.getByRole("button", { name: "Xem biên lai" }).click()
  // the tab opens blank inside the click, then navigates to the signed link
  await (await popup).waitForURL("https://media.example/e2e-receipt.pdf")
  expect(file.requests).toHaveLength(1)
})

test("ORD-010 công ty: xem đơn của mình (tên gói), hủy đơn chờ", async ({ page }) => {
  await mockLoggedIn(page, { permissions: SAAS_PERMISSIONS })
  await mockApi(page, "/v1/saas/plans", { method: "GET", body: ok(PLANS) })
  await mockApi(page, "/v1/saas/orders", { method: "GET", body: pageOf([ORDER_PENDING, ORDER_APPROVED]) })
  const cancel = await mockApi(page, "/v1/saas/orders/71/cancel", { body: ok({ ...ORDER_PENDING, status: "CANCELLED" }) })
  await page.goto("/orders")
  const row = page.getByRole("row").filter({ hasText: "ORD-E2E-0071" })
  await expect(row).toContainText("E2E Pro")

  await page.getByRole("button", { name: "Thao tác cho đơn ORD-E2E-0070" }).click()
  await expect(page.getByRole("menuitem", { name: "Hủy đơn" })).toHaveCount(0) // approved: view only
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Thao tác cho đơn ORD-E2E-0071" }).click()
  await page.getByRole("menuitem", { name: "Hủy đơn" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Hủy đơn" }).click()
  await expect(page.getByText("Đã hủy đơn")).toBeVisible()
  expect(cancel.requests).toHaveLength(1)
})

test("REQ-001 Super Admin từ chối yêu cầu gói kèm ghi chú", async ({ page }) => {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/saas/admin/plan-requests", { method: "GET", body: pageOf(PLAN_REQUESTS) })
  await mockApi(page, "/v1/saas/admin/plan-requests/status-counts", { body: ok({ all: 1, pending: 1 }) })
  const reject = await mockApi(page, "/v1/saas/admin/plan-requests/31/reject", { body: ok({ ...PLAN_REQUESTS[0], status: "REJECTED" }) })
  await page.goto("/plan-requests")
  await expect(page.getByRole("row").filter({ hasText: "E2E Acme Co., Ltd" })).toContainText("Xin nâng cấp")
  await page.getByRole("button", { name: "Từ chối yêu cầu của E2E Acme Co., Ltd" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Ghi chú").fill("Chưa đủ điều kiện")
  await dialog.getByRole("button", { name: "Từ chối" }).click()
  await expect(dialog).toBeHidden()
  expect(reject).toEqual([{ notes: "Chưa đủ điều kiện" }])
})

test("REQ-002 công ty hủy yêu cầu đang chờ", async ({ page }) => {
  await mockLoggedIn(page, { permissions: SAAS_PERMISSIONS })
  await mockApi(page, "/v1/saas/plan-requests", { method: "GET", body: pageOf(PLAN_REQUESTS) })
  const cancel = await mockApi(page, "/v1/saas/plan-requests/31/cancel", { body: ok({}) })
  await page.goto("/plan-requests")
  await page.getByRole("button", { name: "Hủy đơn" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Hủy đơn" }).click()
  await expect.poll(() => cancel.requests.length).toBe(1)
})
