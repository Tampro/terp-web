// @ts-check
/**
 * §5 HR dashboard parts on the HRM tab. Spec: report-service GET /v1/reports/hr-dashboard → one {data, error} per part
 * (employeesByBranch, recentPromotions, recentTerminations, upcomingEvents, …; COMMON_004 = no permission); requested
 * only while the HRM tab is shown.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

const HR = {
  today: "2026-11-23",
  employeesByBranch: { data: [{ branchId: "1", name: "E2E Hà Nội", employees: 4 }, { branchId: "2", name: "E2E HCM", employees: 2 }], error: null },
  recentPromotions: { data: [{ id: "7", employee: { id: "3", fullName: "E2E Trần Bình" }, newDesignation: { name: "E2E Team Lead" }, promotionDate: "2026-11-20", status: "APPROVED" }], error: null },
  recentTerminations: { data: null, error: "COMMON_004" },
  upcomingEvents: { data: [{ id: "9", title: "E2E Year-end party", eventType: { name: "E2E Team Building" }, startDate: "2026-11-27", startTime: "18:00:00", color: "#3B82F6" }], error: null },
  unavailable: { recentTerminations: "COMMON_004" },
}

/** @param {import('@playwright/test').Page} page @param {string[]} permissions */
async function open(page, permissions) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/reports/dashboard", { body: ok({}) })
  await mockApi(page, "/v1/reports/calendar", { body: ok({ upcoming: [] }) })
  const hr = await mockApi(page, "/v1/reports/hr-dashboard", { body: ok(HR) })
  await page.goto("/dashboard")
  return hr
}

test("HRDASH-001 tab Nhân sự: nhân viên theo chi nhánh, thăng chức, sự kiện công ty; phần không có quyền thì báo @smoke", async ({ page }) => {
  const hr = await open(page, ["EMPLOYEE_VIEW", "RECRUITMENT_VIEW"])
  const box = page.getByTestId("hr-overview")
  await expect(box.getByTestId("hr-branches").locator("li")).toHaveCount(2)
  await expect(box.getByTestId("hr-branches")).toContainText("E2E Hà Nội")
  await expect(box.getByText("E2E Trần Bình")).toBeVisible()
  await expect(box.getByText(/E2E Team Lead · 20\/11\/2026/)).toBeVisible()
  await expect(box.getByText("Đã duyệt").first()).toBeVisible()
  await expect(box.getByTestId("hr-events")).toContainText("27/11/2026 18:00 · E2E Team Building")
  await expect(box.getByText("Bạn không có quyền xem mục này.")).toBeVisible()
  expect(hr.length).toBe(1)
  // another tab does not request it again
  await page.getByRole("tab", { name: "Tuyển dụng" }).click()
  await expect(box).toBeHidden()
  expect(hr.length).toBe(1)
})

test("HRDASH-002 không có quyền nhân sự thì không gọi hr-dashboard", async ({ page }) => {
  const hr = await open(page, ["RECRUITMENT_VIEW"])
  await expect(page.getByRole("tab", { name: "Tuyển dụng" }).or(page.getByTestId("cdash.activeJobs")).first()).toBeVisible()
  await expect(page.getByTestId("hr-overview")).toHaveCount(0)
  expect(hr.length).toBe(0)
})
